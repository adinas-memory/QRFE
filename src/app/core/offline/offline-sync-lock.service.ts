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
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return false;
    }

    const clientInstanceId = (await this.clientInstance.whenReady())?.trim() ?? '';
    if (!clientInstanceId) {
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H2',location:'offline-sync-lock.service.ts:beginSync',message:'beginSync aborted — no client instance id',data:{restaurantId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H1',location:'offline-sync-lock.service.ts:beginSync',message:'beginSync response',data:{restaurantId,acquired,hasClientInstanceId:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (acquired) {
        this.localLockHeld = true;
        this.setRestaurantSyncLocked(true);
      }
      return acquired;
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : null;
      const message = err instanceof HttpErrorResponse
        ? (typeof err.error === 'object' && err.error && 'message' in err.error
          ? String((err.error as { message?: string }).message)
          : err.message)
        : String(err);
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H1',location:'offline-sync-lock.service.ts:beginSync',message:'beginSync failed',data:{restaurantId,status,message,hasClientInstanceId:!!clientInstanceId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
