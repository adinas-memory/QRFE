import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, debounceTime, filter, firstValueFrom, take } from 'rxjs';
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
  private queueProcessor: OfflineQueueProcessor | null = null;

  constructor(
    private readonly injector: Injector,
    private readonly onlineState: OnlineStateService,
    private readonly offlineDb: OfflineDbService,
    private readonly auth: AuthService,
  ) {
    this.auth.loggedIn$.subscribe(() => {
      void this.onSessionRestored();
    });

    this.onlineState.online$.pipe(
      debounceTime(500),
      filter(isOnline => isOnline),
    ).subscribe(() => {
      if (!this.wasOnline) {
        void this.schedulePendingSyncWithJitter();
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

  /** Called after login when a pending offline queue may exist from a prior session. */
  async onSessionRestored(): Promise<void> {
    await this.schedulePendingSyncWithJitter();
  }

  /** Waits for any active countdown, then drains the offline queue. */
  async runWhenAllowed(): Promise<void> {
    await this.waitForCountdownToFinish();
    await this.getQueueProcessor().processQueue();
  }

  private getQueueProcessor(): OfflineQueueProcessor {
    this.queueProcessor ??= this.injector.get(OfflineQueueProcessor);
    return this.queueProcessor;
  }

  private async schedulePendingSyncWithJitter(): Promise<void> {
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
      await this.getQueueProcessor().processQueue();
      return;
    }

    this.drainScheduled = true;
    this.countdownSubject.next(delaySeconds);

    this.countdownIntervalId = setInterval(() => {
      const current = this.countdownSubject.value;
      if (current === null) {
        return;
      }
      if (current <= 1) {
        this.clearCountdownTimer();
        this.countdownSubject.next(null);
        this.drainScheduled = false;
        void this.getQueueProcessor().processQueue();
        return;
      }
      this.countdownSubject.next(current - 1);
    }, 1000);
  }

  private cancelCountdown(): void {
    this.clearCountdownTimer();
    this.countdownSubject.next(null);
    this.drainScheduled = false;
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
