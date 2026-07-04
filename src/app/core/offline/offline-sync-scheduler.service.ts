import { Injectable, Injector, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OfflineDbService } from './offline-db';
import { OfflineQueueProcessor } from './offline-queue-processor.service';
import { OnlineStateService } from './online-state-service';
import { OrderSyncService } from '../services/order-service/order-sync.service';
import { OfflinePolicyService } from './offline-policy.service';
import { OfflineSyncLockService } from './offline-sync-lock.service';
import {
  computeCentralizedReconnectDelaySeconds,
  OFFLINE_SYNC_JITTER_MAX_SECONDS,
} from './offline-sync.util';

export { OFFLINE_SYNC_JITTER_MAX_SECONDS };

export type OfflineReconnectDelayResolver = (restaurantId: string, nowMs?: number) => number;

export const OFFLINE_RECONNECT_DELAY_RESOLVER = new InjectionToken<OfflineReconnectDelayResolver>(
  'OFFLINE_RECONNECT_DELAY_RESOLVER',
  { factory: () => computeCentralizedReconnectDelaySeconds },
);

@Injectable({ providedIn: 'root' })
export class OfflineSyncSchedulerService {
  private readonly countdownSubject = new BehaviorSubject<number | null>(null);
  /** Seconds remaining until sync starts; null when idle. */
  readonly syncCountdownSeconds$ = this.countdownSubject.asObservable();

  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private wasOnline = true;
  private reconnectSyncPending = false;
  private drainScheduled = false;
  private schedulingInProgress = false;
  private schedulePromise: Promise<void> | null = null;
  private queueProcessor: OfflineQueueProcessor | null = null;
  private orderSync: OrderSyncService | null = null;
  private offlineSyncLock: OfflineSyncLockService | null = null;
  /** True when this primary session acquired the restaurant lock for reconnect drain. */
  private reconnectRestaurantLockHeld = false;
  private readonly resolveReconnectDelay = inject(OFFLINE_RECONNECT_DELAY_RESOLVER);
  private readonly syncBlockedSubject = new BehaviorSubject(false);
  /** Emits true while reconnect jitter is preparing or counting down. */
  readonly syncBlocked$ = this.syncBlockedSubject.asObservable();

  private readonly batchSyncDrainingSubject = new BehaviorSubject(false);
  /** Emits true while the reconnect batch queue drain is in progress (after jitter). */
  readonly batchSyncDraining$ = this.batchSyncDrainingSubject.asObservable();

  constructor(
    private readonly injector: Injector,
    private readonly onlineState: OnlineStateService,
    private readonly offlineDb: OfflineDbService,
    private readonly auth: AuthService,
    private readonly offlinePolicy: OfflinePolicyService,
  ) {
    this.auth.loggedIn$.subscribe(() => {
      void this.ensureScheduled();
    });

    this.onlineState.online$.pipe(filter(isOnline => isOnline)).subscribe(() => {
      if (!this.wasOnline) {
        this.reconnectSyncPending = true;
        void this.ensureScheduled();
      }
      this.wasOnline = true;
    });

    this.onlineState.online$.pipe(filter(isOnline => !isOnline)).subscribe(() => {
      this.wasOnline = false;
      this.reconnectSyncPending = false;
      this.cancelCountdown();
    });

    this.onlineState.pingOk$.subscribe(() => {
      this.releaseStuckReconnectUi();
    });
  }

  isCountdownActive(): boolean {
    return this.countdownSubject.value !== null;
  }

  /** True when an offline→online transition is pending heavy reconnect scheduling. */
  isReconnectPending(): boolean {
    return this.reconnectSyncPending;
  }

  /** True while jitter is being calculated or countdown is running — queue must not drain yet. */
  isSyncBlocked(): boolean {
    return this.syncBlockedSubject.value;
  }

  private refreshSyncBlocked(): void {
    const blocked = this.schedulingInProgress || this.drainScheduled || this.isCountdownActive();
    if (blocked !== this.syncBlockedSubject.value) {
      this.syncBlockedSubject.next(blocked);
    }
  }

  /** Called after login when a pending offline queue may exist from a prior session. */
  async onSessionRestored(): Promise<void> {
    await this.ensureScheduled();
  }

  /** Ensures jitter/countdown ran, then waits until sync may proceed. */
  async runWhenAllowed(): Promise<void> {
    await this.ensureScheduled();
    await this.waitForCountdownToFinish();
  }

  /** Coalesce concurrent schedule attempts (reconnect, SSE, trySyncNow). */
  async ensureScheduled(): Promise<void> {
    if (!this.onlineState.isOnline) {
      return;
    }
    if (!this.schedulePromise) {
      this.schedulePromise = this.schedulePendingSyncWithJitter().finally(() => {
        this.schedulePromise = null;
      });
    }
    await this.schedulePromise;
  }

  private getQueueProcessor(): OfflineQueueProcessor {
    this.queueProcessor ??= this.injector.get(OfflineQueueProcessor);
    return this.queueProcessor;
  }

  private getOrderSync(): OrderSyncService {
    this.orderSync ??= this.injector.get(OrderSyncService);
    return this.orderSync;
  }

  private getOfflineSyncLock(): OfflineSyncLockService {
    this.offlineSyncLock ??= this.injector.get(OfflineSyncLockService);
    return this.offlineSyncLock;
  }

  private async schedulePendingSyncWithJitter(): Promise<void> {
    this.schedulingInProgress = true;
    this.refreshSyncBlocked();
    try {
      await this.getQueueProcessor().recoverOrphanedCartsPublic();

      const pendingCount = await this.getPendingCount();
      const isReconnect = this.reconnectSyncPending;
      this.reconnectSyncPending = false;

      if (!this.offlinePolicy.shouldRunHeavyOfflineReconnectSync({ isReconnect, pendingQueueCount: pendingCount })) {
        if (!this.offlinePolicy.isOfflinePrimaryDevice()) {
          void this.refreshSecondaryLockStatus();
        }
        return;
      }

      if (this.isCountdownActive() || this.drainScheduled) {
        return;
      }

      const shouldLock = pendingCount > 0 && this.offlinePolicy.isOfflinePrimaryDevice();
      if (shouldLock) {
        const acquired = await this.getOfflineSyncLock().beginSync();
        // #region agent log
        fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H5',location:'offline-sync-scheduler.service.ts:schedulePendingSyncWithJitter',message:'early restaurant lock begin',data:{pendingCount,acquired,shouldLock},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!acquired) {
          console.warn('[OfflineSync] Could not acquire restaurant sync lock before countdown; skipping heavy sync.');
          return;
        }
        this.reconnectRestaurantLockHeld = true;
      }

      const restaurantId = this.auth.getUserSnapshot()?.restaurantId ?? '';
      const delaySeconds = restaurantId
        ? this.resolveReconnectDelay(restaurantId)
        : 0;

      if (delaySeconds <= 0) {
        await this.finishReconnectSync();
        return;
      }

      this.drainScheduled = true;
      this.schedulingInProgress = false;
      this.countdownSubject.next(delaySeconds);
      this.refreshSyncBlocked();

      this.countdownIntervalId = setInterval(() => {
        const current = this.countdownSubject.value;
        if (current === null) {
          return;
        }
        if (current <= 1) {
          this.clearCountdownTimer();
          this.countdownSubject.next(null);
          this.drainScheduled = false;
          this.refreshSyncBlocked();
          void this.finishReconnectSync();
          return;
        }
        this.countdownSubject.next(current - 1);
      }, 1000);
    } finally {
      if (!this.isCountdownActive() && !this.drainScheduled) {
        this.schedulingInProgress = false;
      }
      this.refreshSyncBlocked();
    }
  }

  private async finishReconnectSync(): Promise<void> {
    try {
      const pendingCount = await this.getPendingCount();
      if (pendingCount > 0) {
        try {
          await this.drainQueue(false);
          await this.getOrderSync().reconcileAfterOfflineSync();
        } finally {
          await this.releaseReconnectRestaurantLock();
        }
        return;
      }
      await this.getOrderSync().reconcileAfterOfflineSync();
    } finally {
      this.releaseStuckReconnectUi();
    }
  }

  /**
   * Clears reconnect sync UI when /api/sync did not run or ping-lite confirms connectivity.
   * Does not interrupt an active countdown or queue drain.
   */
  private releaseStuckReconnectUi(): void {
    if (this.isCountdownActive() || this.batchSyncDrainingSubject.value) {
      return;
    }

    this.clearCountdownTimer();
    this.countdownSubject.next(null);
    this.drainScheduled = false;
    this.schedulingInProgress = false;
    this.schedulePromise = null;
    this.batchSyncDrainingSubject.next(false);
    this.refreshSyncBlocked();
  }

  private async drainQueue(emitDrainedOnComplete = true): Promise<void> {
    this.batchSyncDrainingSubject.next(true);
    try {
      await this.getQueueProcessor().processQueue({
        force: true,
        emitDrainedOnComplete,
      });
    } finally {
      this.batchSyncDrainingSubject.next(false);
      this.drainScheduled = false;
      this.refreshSyncBlocked();
    }
  }

  private cancelCountdown(): void {
    this.clearCountdownTimer();
    this.countdownSubject.next(null);
    this.drainScheduled = false;
    this.schedulingInProgress = false;
    this.schedulePromise = null;
    void this.releaseReconnectRestaurantLock();
    this.refreshSyncBlocked();
  }

  private async releaseReconnectRestaurantLock(): Promise<void> {
    if (!this.reconnectRestaurantLockHeld) {
      return;
    }
    this.reconnectRestaurantLockHeld = false;
    await this.getOfflineSyncLock().completeSync();
  }

  private async refreshSecondaryLockStatus(): Promise<void> {
    try {
      const status = await this.getOfflineSyncLock().refreshStatus();
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H4',location:'offline-sync-scheduler.service.ts:refreshSecondaryLockStatus',message:'secondary polled lock status',data:{locked:status.locked},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (err) {
      console.warn('[OfflineSync] Failed to refresh restaurant sync lock status', err);
    }
  }

  private clearCountdownTimer(): void {
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private async waitForCountdownToFinish(): Promise<void> {
    if (!this.isCountdownActive()) {
      return;
    }
    await firstValueFrom(
      this.syncCountdownSeconds$.pipe(
        filter(seconds => seconds === null),
        take(1),
      ),
    );
  }

  private async getPendingCount(): Promise<number> {
    const restaurantId = this.auth.getUserSnapshot()?.restaurantId;
    if (!restaurantId) {
      return 0;
    }
    const pending = await this.offlineDb.getPendingActionsForRestaurant(restaurantId);
    return pending.length;
  }
}
