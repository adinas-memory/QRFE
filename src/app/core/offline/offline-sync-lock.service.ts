import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { isAssignedRestaurantId } from '../auth/restaurant-id.util';

export interface OfflineSyncLockStatus {
  locked: boolean;
  holderClientInstanceId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncLockService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');

  private readonly lockedSubject = new BehaviorSubject(false);
  /** True while the restaurant is locked for offline replay (SSE or local begin). */
  readonly restaurantSyncLocked$ = this.lockedSubject.asObservable();

  private localLockHeld = false;

  isRestaurantSyncLocked(): boolean {
    return this.lockedSubject.value;
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

    const status = await firstValueFrom(
      this.http.get<OfflineSyncLockStatus>(`${this.apiUrl}/api/offline-sync/status`, {
        params: { restaurantId },
        withCredentials: true,
      }),
    );
    this.setRestaurantSyncLocked(status.locked === true);
    return status;
  }

  async beginSync(): Promise<boolean> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return false;
    }

    const response = await firstValueFrom(
      this.http.post<{ acquired: boolean }>(
        `${this.apiUrl}/api/offline-sync/begin`,
        {},
        { params: { restaurantId }, withCredentials: true },
      ),
    );

    const acquired = response?.acquired === true;
    if (acquired) {
      this.localLockHeld = true;
      this.setRestaurantSyncLocked(true);
    }
    return acquired;
  }

  async completeSync(): Promise<boolean> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId || !this.localLockHeld) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ released: boolean }>(
          `${this.apiUrl}/api/offline-sync/complete`,
          {},
          { params: { restaurantId }, withCredentials: true },
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
