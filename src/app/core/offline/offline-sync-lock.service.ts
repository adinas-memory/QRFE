import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { isAssignedRestaurantId } from '../auth/restaurant-id.util';
import { ClientInstanceService } from '../services/device/client-instance.service';
import { CLIENT_INSTANCE_HEADER } from '../interceptors/client-instance.interceptor';
import { SKIP_CONNECTIVITY_OFFLINE } from '../interceptors/auth.interceptor';
import { OnlineStateService } from './online-state-service';
// #region agent log
import { debugLog } from './debug-log.util';
// #endregion

export interface OfflineSyncLockStatus {
  locked: boolean;
  holderClientInstanceId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncLockService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly clientInstance = inject(ClientInstanceService);
  private readonly onlineState = inject(OnlineStateService);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');

  private static readonly LOCK_WATCH_IDLE_MS = 15_000;
  private static readonly LOCK_WATCH_ACTIVE_MS = 5_000;

  private lockWatchIntervalId: ReturnType<typeof setInterval> | null = null;
  private lockWatchActive = false;
  private lastPolledLocked: boolean | null = null;

  private readonly lockedSubject = new BehaviorSubject(false);
  /** True while the restaurant is locked for offline replay (SSE or local begin). */
  readonly restaurantSyncLocked$ = this.lockedSubject.asObservable();

  private readonly secondaryAwaitingSubject = new BehaviorSubject(false);
  /** Secondary device waits for primary reconnect sync to finish. */
  readonly secondaryAwaitingPrimaryReconnect$ = this.secondaryAwaitingSubject.asObservable();

  private localLockHeld = false;

  hasLocalLockHeld(): boolean {
    return this.localLockHeld;
  }

  isRestaurantSyncLocked(): boolean {
    return this.lockedSubject.value;
  }

  isSecondaryAwaitingPrimaryReconnect(): boolean {
    return this.secondaryAwaitingSubject.value;
  }

  setSecondaryAwaitingPrimaryReconnect(awaiting: boolean): void {
    if (awaiting !== this.secondaryAwaitingSubject.value) {
      this.secondaryAwaitingSubject.next(awaiting);
    }
  }

  setRestaurantSyncLocked(locked: boolean): void {
    if (locked !== this.lockedSubject.value) {
      this.lockedSubject.next(locked);
    }
  }

  /** Secondary devices poll lock status (slow when idle, faster while locked). */
  startRestaurantLockWatch(): void {
    if (this.lockWatchIntervalId !== null) {
      return;
    }
    this.scheduleLockWatchTick(OfflineSyncLockService.LOCK_WATCH_IDLE_MS);
    void this.tickRestaurantLockWatch();
  }

  stopRestaurantLockWatch(): void {
    if (this.lockWatchIntervalId !== null) {
      clearInterval(this.lockWatchIntervalId);
      this.lockWatchIntervalId = null;
    }
    this.lockWatchActive = false;
    this.lastPolledLocked = null;
  }

  private scheduleLockWatchTick(intervalMs: number): void {
    if (this.lockWatchIntervalId !== null) {
      clearInterval(this.lockWatchIntervalId);
    }
    this.lockWatchIntervalId = setInterval(() => {
      void this.tickRestaurantLockWatch();
    }, intervalMs);
  }

  private async tickRestaurantLockWatch(): Promise<void> {
    const user = this.auth.getUserSnapshot();
    if (!user?.restaurantId || user.isOfflinePrimaryDevice || !this.onlineState.isOnline) {
      return;
    }
    // Secondary reconnect poll owns /offline-sync/status while awaiting primary sync.
    if (this.isSecondaryAwaitingPrimaryReconnect()) {
      return;
    }

    try {
      const status = await this.refreshStatus();
      if (this.lastPolledLocked !== status.locked) {
        this.lastPolledLocked = status.locked;
        // #region agent log
        debugLog('H_FREEZE_1', 'offline-sync-lock.service.ts:lockWatch', 'polled lock status changed', {
          locked: status.locked,
        });
        // #endregion
      }

      const shouldPollFast = status.locked;
      if (shouldPollFast !== this.lockWatchActive) {
        this.lockWatchActive = shouldPollFast;
        this.scheduleLockWatchTick(
          shouldPollFast ? OfflineSyncLockService.LOCK_WATCH_ACTIVE_MS : OfflineSyncLockService.LOCK_WATCH_IDLE_MS,
        );
      }
    } catch {
      // Transient poll failure — skip; SKIP_CONNECTIVITY_OFFLINE avoids offline flip.
    }
  }

  async refreshStatus(): Promise<OfflineSyncLockStatus> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return { locked: false };
    }

    const raw = await firstValueFrom(
      this.http.get<OfflineSyncLockStatus & { Locked?: boolean }>(`${this.apiUrl}/api/offline-sync/status`, {
        params: { restaurantId },
        withCredentials: true,
        context: new HttpContext().set(SKIP_CONNECTIVITY_OFFLINE, true),
      }),
    );
    const locked = raw.locked === true || raw.Locked === true;
    const status: OfflineSyncLockStatus = { locked, holderClientInstanceId: raw.holderClientInstanceId };
    this.setRestaurantSyncLocked(locked);
    return status;
  }

  async beginSync(): Promise<boolean> {
    if (this.beginInFlight) {
      return this.beginInFlight;
    }
    this.beginInFlight = this.doBeginSync().finally(() => {
      this.beginInFlight = null;
    });
    return this.beginInFlight;
  }

  private beginInFlight: Promise<boolean> | null = null;

  private async doBeginSync(): Promise<boolean> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return false;
    }

    const clientInstanceId = (await this.clientInstance.whenReady())?.trim() ?? '';
    if (!clientInstanceId) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ acquired: boolean }>(
          `${this.apiUrl}/api/offline-sync/begin`,
          {},
          {
            params: { restaurantId },
            withCredentials: true,
            headers: { [CLIENT_INSTANCE_HEADER]: clientInstanceId },
          },
        ),
      );

      const acquired = response?.acquired === true;
      if (acquired) {
        this.localLockHeld = true;
        this.setRestaurantSyncLocked(true);
      }
      return acquired;
    } catch {
      return false;
    }
  }

  async completeSync(): Promise<boolean> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId || !this.localLockHeld) {
      return false;
    }

    const clientInstanceId = (await this.clientInstance.whenReady())?.trim() ?? '';

    try {
      const response = await firstValueFrom(
        this.http.post<{ released: boolean }>(
          `${this.apiUrl}/api/offline-sync/complete`,
          {},
          {
            params: { restaurantId },
            withCredentials: true,
            headers: clientInstanceId ? { [CLIENT_INSTANCE_HEADER]: clientInstanceId } : {},
          },
        ),
      );
      return response?.released === true;
    } finally {
      this.localLockHeld = false;
      this.setRestaurantSyncLocked(false);
    }
  }

  private resolveRestaurantId(): string | null {
    const id = this.auth.getUserSnapshot()?.restaurantId ?? this.auth.getUserRestaurantId();
    return typeof id === 'string' && isAssignedRestaurantId(id) ? id : null;
  }
}
