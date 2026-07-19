import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { isAssignedRestaurantId } from '../auth/restaurant-id.util';
import { OfflineDbService } from '../offline/offline-db';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Retry silent apply while waiting for open orders to clear. */
const DEFERRED_RETRY_MS = 60 * 1000;

/**
 * Silent PWA update via Angular ngsw: when a new version is ready, activate+reload
 * only if the restaurant has no open orders locally. Otherwise defer and retry.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly offlineDb = inject(OfflineDbService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /** True after VERSION_READY until activate succeeds / page reloads. */
  readonly updateAvailable = signal(false);
  /** Kept for prompt component compatibility; silent flow never opens the modal. */
  readonly modalVisible = signal(false);
  readonly updateBlocked = signal(false);
  readonly updating = signal(false);

  private started = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private deferredRetryTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private applyInFlight = false;

  /** Overridable in unit tests. */
  reload: () => void = () => {
    document.location.reload();
  };

  start(): void {
    if (this.started || !this.swUpdate.isEnabled) {
      return;
    }
    this.started = true;

    this.swUpdate.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.updateAvailable.set(true);
        this.updateBlocked.set(false);
        this.modalVisible.set(false);
        void this.trySilentUpdate();
        this.ensureDeferredRetry();
      });

    void this.swUpdate.checkForUpdate().catch(() => undefined);

    this.checkTimer = setInterval(() => {
      void this.swUpdate.checkForUpdate().catch(() => undefined);
    }, CHECK_INTERVAL_MS);

    this.visibilityHandler = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void this.swUpdate.checkForUpdate().catch(() => undefined);
      if (this.updateAvailable()) {
        void this.trySilentUpdate();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.destroyRef.onDestroy(() => {
      if (this.checkTimer != null) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
      this.clearDeferredRetry();
      if (this.visibilityHandler) {
        document.removeEventListener('visibilitychange', this.visibilityHandler);
        this.visibilityHandler = null;
      }
    });
  }

  dismiss(): void {
    this.modalVisible.set(false);
    this.updateBlocked.set(false);
  }

  setModalVisible(visible: boolean): void {
    // Silent-only flow: never surface the update modal.
    this.modalVisible.set(false);
    if (!visible) {
      this.updateBlocked.set(false);
    }
  }

  /** Manual path (tests / future UI): same gate as silent apply. */
  async confirmUpdate(): Promise<void> {
    await this.trySilentUpdate();
  }

  /**
   * Activate + reload when safe. If open orders exist, leave updateAvailable and retry later.
   */
  async trySilentUpdate(): Promise<void> {
    if (!this.updateAvailable() || this.updating() || this.applyInFlight) {
      return;
    }
    this.applyInFlight = true;
    this.updateBlocked.set(false);

    try {
      const restaurantId = this.auth.getUserSnapshot()?.restaurantId ?? null;
      if (isAssignedRestaurantId(restaurantId)) {
        const hasOpen = await this.offlineDb.hasAnyActiveOpenOrdersLocal(restaurantId);
        if (hasOpen) {
          this.updateBlocked.set(true);
          this.modalVisible.set(false);
          this.ensureDeferredRetry();
          return;
        }
      }

      this.clearDeferredRetry();
      this.updating.set(true);
      try {
        await this.swUpdate.activateUpdate();
        this.reload();
      } catch {
        this.updating.set(false);
      }
    } finally {
      this.applyInFlight = false;
    }
  }

  private ensureDeferredRetry(): void {
    if (this.deferredRetryTimer != null) {
      return;
    }
    this.deferredRetryTimer = setInterval(() => {
      if (!this.updateAvailable() || this.updating()) {
        this.clearDeferredRetry();
        return;
      }
      void this.trySilentUpdate();
    }, DEFERRED_RETRY_MS);
  }

  private clearDeferredRetry(): void {
    if (this.deferredRetryTimer != null) {
      clearInterval(this.deferredRetryTimer);
      this.deferredRetryTimer = null;
    }
  }
}
