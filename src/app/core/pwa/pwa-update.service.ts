import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { isAssignedRestaurantId } from '../auth/restaurant-id.util';
import { OfflineDbService } from '../offline/offline-db';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Prompt-based PWA update via Angular ngsw (not silent auto-activate).
 * Blocks activate/reload when the restaurant has open orders locally.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly offlineDb = inject(OfflineDbService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly updateAvailable = signal(false);
  readonly modalVisible = signal(false);
  readonly updateBlocked = signal(false);
  readonly updating = signal(false);

  private started = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

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
        this.modalVisible.set(true);
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
      if (this.updateAvailable() && !this.modalVisible()) {
        this.updateBlocked.set(false);
        this.modalVisible.set(true);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.destroyRef.onDestroy(() => {
      if (this.checkTimer != null) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
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
    this.modalVisible.set(visible);
    if (!visible) {
      this.updateBlocked.set(false);
    }
  }

  async confirmUpdate(): Promise<void> {
    if (this.updating()) {
      return;
    }
    this.updateBlocked.set(false);

    const restaurantId = this.auth.getUserSnapshot()?.restaurantId ?? null;
    if (isAssignedRestaurantId(restaurantId)) {
      const hasOpen = await this.offlineDb.hasAnyActiveOpenOrdersLocal(restaurantId);
      if (hasOpen) {
        this.updateBlocked.set(true);
        this.modalVisible.set(true);
        return;
      }
    }

    this.updating.set(true);
    try {
      await this.swUpdate.activateUpdate();
      this.reload();
    } catch {
      this.updating.set(false);
    }
  }
}
