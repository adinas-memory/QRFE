import { Injectable, Injector, InjectionToken, inject } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, pairwise, startWith, take } from 'rxjs';
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
// #region agent log
import { debugLog } from './debug-log.util';
// #endregion

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
  private reconnectSyncPending = false;
  private wentOfflineAt: number | null = null;
  private lastSuccessfulReconnectAt = 0;
  private drainScheduled = false;
  private schedulingInProgress = false;
  private schedulePromise: Promise<void> | null = null;
  private queueProcessor: OfflineQueueProcessor | null = null;
  private orderSync: OrderSyncService | null = null;
  private offlineSyncLock: OfflineSyncLockService | null = null;
  /** True when this primary session acquired the restaurant lock for reconnect drain. */
  private reconnectRestaurantLockHeld = false;
  private secondaryPollIntervalId: ReturnType<typeof setInterval> | null = null;
  private secondaryReconnectStartedAt = 0;
  private secondarySawServerLock = false;
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

    this.onlineState.online$
      .pipe(
        startWith(this.onlineState.isOnline),
        pairwise(),
        filter(([wasOnline, isOnline]) => !wasOnline && isOnline),
      )
      .subscribe(() => {
        const offlineMs = this.wentOfflineAt != null ? Date.now() - this.wentOfflineAt : Number.POSITIVE_INFINITY;
        const recentReconnect = this.lastSuccessfulReconnectAt > 0
          && Date.now() - this.lastSuccessfulReconnectAt < 120_000;
        if (offlineMs < 3000 && recentReconnect) {
          return;
        }
        this.reconnectSyncPending = true;
        void this.ensureScheduled();
      });

    this.onlineState.online$
      .pipe(
        startWith(this.onlineState.isOnline),
        pairwise(),
        filter(([wasOnline, isOnline]) => wasOnline && !isOnline),
      )
      .subscribe(() => {
        this.wentOfflineAt = Date.now();
        this.reconnectSyncPending = false;
        this.stopSecondaryReconnectAwait();
        this.cancelCountdown();
      });
  }

  /** True while primary reconnect jitter, lock, drain, or reconcile is in progress. */
  isReconnectWorkflowActive(): boolean {
    return (
      this.reconnectSyncPending
      || this.schedulingInProgress
      || this.isCountdownActive()
      || this.drainScheduled
      || this.batchSyncDrainingSubject.value
      || this.reconnectRestaurantLockHeld
    );
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
    if (this.isCountdownActive() || this.drainScheduled || this.batchSyncDrainingSubject.value) {
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

      const willRunHeavySync = this.offlinePolicy.shouldRunHeavyOfflineReconnectSync({ isReconnect, pendingQueueCount: pendingCount });
      // #region agent log
      debugLog('H_HEAVYSYNC_1', 'offline-sync-scheduler.service.ts:schedulePendingSyncWithJitter', 'heavy sync decision', {
        isReconnect, pendingCount, isOfflinePrimaryDevice: this.offlinePolicy.isOfflinePrimaryDevice(), willRunHeavySync,
      });
      // #endregion

      if (!willRunHeavySync) {
        if (!this.offlinePolicy.isOfflinePrimaryDevice() && isReconnect) {
          await this.handleSecondaryReconnect();
        } else if (!this.offlinePolicy.isOfflinePrimaryDevice()) {
          void this.refreshSecondaryLockStatus();
        }
        return;
      }

      if (this.isCountdownActive() || this.drainScheduled) {
        return;
      }

      const shouldLock = this.offlinePolicy.isOfflinePrimaryDevice();
      if (shouldLock) {
        const acquired = await this.getOfflineSyncLock().beginSync();
        if (!acquired) {
          const lock = this.getOfflineSyncLock();
          if (lock.hasLocalLockHeld()) {
            this.reconnectRestaurantLockHeld = true;
          } else {
            console.warn('[OfflineSync] Could not acquire restaurant sync lock before countdown; skipping heavy sync.');
            return;
          }
        } else {
          this.reconnectRestaurantLockHeld = true;
        }
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
      try {
        if (pendingCount > 0) {
          await this.drainQueue(false);
        }
        await this.getOrderSync().reconcileAfterOfflineSync();
      } finally {
        await this.releaseReconnectRestaurantLock();
      }
    } finally {
      this.lastSuccessfulReconnectAt = Date.now();
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
    if (this.isReconnectWorkflowActive()) {
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
      await this.getOfflineSyncLock().refreshStatus();
    } catch (err) {
      console.warn('[OfflineSync] Failed to refresh restaurant sync lock status', err);
    }
  }

  private async handleSecondaryReconnect(): Promise<void> {
    const restaurantId = this.auth.getUserSnapshot()?.restaurantId ?? '';
    if (!restaurantId) {
      return;
    }

    const lock = this.getOfflineSyncLock();
    if (lock.isSecondaryAwaitingPrimaryReconnect()) {
      // #region agent log
      debugLog('H_FREEZE_1', 'offline-sync-scheduler.service.ts:handleSecondaryReconnect',
        'secondary freeze already active — ensure poll + snapshot', { restaurantId });
      // #endregion
      this.startSecondaryPoll(restaurantId);
      void this.getOrderSync().refreshRestaurantSnapshot({ force: true });
      return;
    }

    lock.setSecondaryAwaitingPrimaryReconnect(true);
    this.secondaryReconnectStartedAt = Date.now();
    this.secondarySawServerLock = false;

    // #region agent log
    debugLog('H_FREEZE_1', 'offline-sync-scheduler.service.ts:handleSecondaryReconnect',
      'secondary freeze started', { restaurantId });
    // #endregion

    try {
      const status = await lock.refreshStatus();
      if (status.locked) {
        this.secondarySawServerLock = true;
      }
      await this.getOrderSync().refreshRestaurantSnapshot({ force: true });
    } catch (err) {
      console.warn('[OfflineSync] Secondary reconnect coordination failed', err);
    }

    this.startSecondaryPoll(restaurantId);
  }

  private startSecondaryPoll(restaurantId: string): void {
    this.stopSecondaryPoll();
    this.secondaryPollIntervalId = setInterval(() => {
      void this.tickSecondaryPoll(restaurantId);
    }, 5000);
    void this.tickSecondaryPoll(restaurantId);
  }

  private stopSecondaryPoll(): void {
    if (this.secondaryPollIntervalId !== null) {
      clearInterval(this.secondaryPollIntervalId);
      this.secondaryPollIntervalId = null;
    }
  }

  private stopSecondaryReconnectAwait(): void {
    // #region agent log
    debugLog('H_FREEZE_1', 'offline-sync-scheduler.service.ts:stopSecondaryReconnectAwait',
      'secondary freeze cleared', { sawServerLock: this.secondarySawServerLock });
    // #endregion
    this.stopSecondaryPoll();
    try {
      this.offlineSyncLock ??= this.injector.get(OfflineSyncLockService);
      this.offlineSyncLock.setSecondaryAwaitingPrimaryReconnect(false);
      void this.offlineSyncLock.refreshStatus().catch(() => {});
    } catch {
      // ignore when lock service is unavailable during teardown
    }
    this.secondarySawServerLock = false;
    this.secondaryReconnectStartedAt = 0;
  }

  private async tickSecondaryPoll(restaurantId: string): Promise<void> {
    if (!this.onlineState.isOnline) {
      this.stopSecondaryReconnectAwait();
      return;
    }

    const lock = this.getOfflineSyncLock();
    if (!lock.isSecondaryAwaitingPrimaryReconnect()) {
      this.stopSecondaryPoll();
      return;
    }

    try {
      const status = await lock.refreshStatus();
      // #region agent log
      debugLog('H_FREEZE_1', 'offline-sync-scheduler.service.ts:tickSecondaryPoll', 'poll tick', {
        locked: status.locked,
        sawServerLockSoFar: this.secondarySawServerLock,
        msSinceStart: Date.now() - this.secondaryReconnectStartedAt,
      });
      // #endregion

      if (!status.locked) {
        const elapsedMs = Date.now() - this.secondaryReconnectStartedAt;
        if (this.secondarySawServerLock || elapsedMs >= 20_000) {
          this.stopSecondaryReconnectAwait();
          await this.getOrderSync().refreshRestaurantSnapshot({ force: true });
        }
        return;
      }

      this.secondarySawServerLock = true;
    } catch (err) {
      console.warn('[OfflineSync] Secondary lock poll failed', err);
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
