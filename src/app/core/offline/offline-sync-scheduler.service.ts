import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, take } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OfflineDbService } from './offline-db';
import { OfflineQueueProcessor } from './offline-queue-processor.service';
import { OnlineStateService } from './online-state-service';

/** Spread offline sync after reconnect to reduce thundering herd (seconds, inclusive). */
export const OFFLINE_SYNC_JITTER_MAX_SECONDS = 60;

@Injectable({ providedIn: 'root' })
export class OfflineSyncSchedulerService {
  private readonly countdownSubject = new BehaviorSubject<number | null>(null);
  /** Seconds remaining until sync starts; null when idle. */
  readonly syncCountdownSeconds$ = this.countdownSubject.asObservable();

  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private wasOnline = true;
  private drainScheduled = false;
  private schedulingInProgress = false;
  private schedulePromise: Promise<void> | null = null;
  private queueProcessor: OfflineQueueProcessor | null = null;
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
  ) {
    this.auth.loggedIn$.subscribe(() => {
      void this.ensureScheduled();
    });

    this.onlineState.online$.pipe(filter(isOnline => isOnline)).subscribe(() => {
      if (!this.wasOnline) {
        void this.ensureScheduled();
      }
      this.wasOnline = true;
    });

    this.onlineState.online$.pipe(filter(isOnline => !isOnline)).subscribe(() => {
      this.wasOnline = false;
      this.cancelCountdown();
    });
  }

  isCountdownActive(): boolean {
    return this.countdownSubject.value !== null;
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

  private async schedulePendingSyncWithJitter(): Promise<void> {
    this.schedulingInProgress = true;
    this.refreshSyncBlocked();
    try {
      await this.getQueueProcessor().recoverOrphanedCartsPublic();

      const pendingCount = await this.getPendingCount();
      if (pendingCount === 0) {
        return;
      }

      if (this.isCountdownActive() || this.drainScheduled) {
        return;
      }

      const delaySeconds = Math.floor(Math.random() * (OFFLINE_SYNC_JITTER_MAX_SECONDS + 1));

      if (delaySeconds <= 0) {
        await this.drainQueue();
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
          void this.drainQueue();
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

  private async drainQueue(): Promise<void> {
    this.batchSyncDrainingSubject.next(true);
    try {
      await this.getQueueProcessor().processQueue({ force: true, emitDrainedOnComplete: true });
    } finally {
      this.batchSyncDrainingSubject.next(false);
    }
  }

  private cancelCountdown(): void {
    this.clearCountdownTimer();
    this.countdownSubject.next(null);
    this.drainScheduled = false;
    this.schedulingInProgress = false;
    this.schedulePromise = null;
    this.refreshSyncBlocked();
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
