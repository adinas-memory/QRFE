import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { OnlineStateService } from './online-state-service';
import { OfflineSyncLockService } from './offline-sync-lock.service';

@Injectable({ providedIn: 'root' })
export class OfflinePolicyService {
  private readonly auth = inject(AuthService);
  private readonly onlineState = inject(OnlineStateService);
  private readonly offlineSyncLock = inject(OfflineSyncLockService);

  private readonly user = toSignal(this.auth.user$, { initialValue: null });
  private readonly isOnline = toSignal(this.onlineState.online$, { initialValue: this.onlineState.isOnline });
  private readonly restaurantSyncLocked = toSignal(this.offlineSyncLock.restaurantSyncLocked$, {
    initialValue: false,
  });
  private readonly secondaryAwaitingPrimaryReconnect = toSignal(
    this.offlineSyncLock.secondaryAwaitingPrimaryReconnect$,
    { initialValue: false },
  );

  readonly isOfflinePrimaryDevice = computed(
    () => this.user()?.isOfflinePrimaryDevice === true,
  );

  readonly isOfflinePrimaryStaffDesignee = computed(
    () => this.user()?.isOfflinePrimaryStaffDesignee === true,
  );

  readonly canUseFullOffline = computed(
    () => !this.isOnline() && this.isOfflinePrimaryDevice(),
  );

  readonly shouldShowBindDeviceCta = computed(
    () =>
      this.isOnline()
      && this.isOfflinePrimaryStaffDesignee()
      && !this.isOfflinePrimaryDevice(),
  );

  readonly shouldShowOfflinePrimaryDeviceBanner = computed(
    () => this.isOfflinePrimaryStaffDesignee() && this.isOfflinePrimaryDevice(),
  );

  /** True when offline and this browser is not the bound primary device (no table/canvas/queue ops). */
  readonly shouldFreezeWhenOffline = computed(
    () => !this.isOnline() && !this.canUseFullOffline(),
  );

  /** True when primary device is replaying offline queue and this device must stay read-only. */
  readonly shouldFreezeForRestaurantSync = computed(
    () =>
      !this.isOfflinePrimaryDevice()
      && (this.restaurantSyncLocked() || this.secondaryAwaitingPrimaryReconnect()),
  );

  /** Block POS/table actions when offline-frozen or restaurant sync lock applies. */
  readonly shouldFreezePosActions = computed(
    () => this.shouldFreezeWhenOffline() || this.shouldFreezeForRestaurantSync(),
  );

  /** Each device may drain its own offline queue while online (primary-only applies to POS actions when offline). */
  readonly canProcessOfflineQueue = computed(
    () => this.isOnline(),
  );

  /**
   * Heavy offline reconnect (countdown, queue drain, reconcile) runs only on the bound primary device
   * when there is a pending offline queue or active open orders locally.
   *
   * Note: reconnect alone is not sufficient; otherwise the primary can lock the restaurant
   * and block other devices even when there's nothing to replay/reconcile.
   */
  shouldRunHeavyOfflineReconnectSync(ctx: {
    isReconnect: boolean;
    pendingQueueCount: number;
    hasAnyOpenOrdersLocal: boolean;
  }): boolean {
    if (!this.isOfflinePrimaryDevice()) {
      return false;
    }
    return ctx.pendingQueueCount > 0 || ctx.hasAnyOpenOrdersLocal;
  }
}
