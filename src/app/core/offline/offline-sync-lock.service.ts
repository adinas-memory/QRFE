import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { isAssignedRestaurantId } from '../auth/restaurant-id.util';
import { ClientInstanceService } from '../services/device/client-instance.service';
import { CLIENT_INSTANCE_HEADER } from '../interceptors/client-instance.interceptor';

export interface OfflineSyncLockStatus {
  locked: boolean;
  holderClientInstanceId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncLockService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly clientInstance = inject(ClientInstanceService);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');

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

  async refreshStatus(): Promise<OfflineSyncLockStatus> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return { locked: false };
    }

    const raw = await firstValueFrom(
      this.http.get<OfflineSyncLockStatus & { Locked?: boolean }>(`${this.apiUrl}/api/offline-sync/status`, {
        params: { restaurantId },
        withCredentials: true,
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
