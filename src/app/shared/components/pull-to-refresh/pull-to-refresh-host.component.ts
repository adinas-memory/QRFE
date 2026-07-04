import { Component, HostListener, inject, signal } from '@angular/core';
import { SpinnerComponent } from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppToastService } from '@app/core/services/toast-service/toast-service.service';
import { OnlineStateService } from '@app/core/offline/online-state-service';
import { OrderSyncService } from '@app/core/services/order-service/order-sync.service';
import {
  computeIndicatorHeight,
  dampPullDistance,
  isPullGestureAllowed,
  PTR_TRIGGER_THRESHOLD_PX,
  shouldTriggerRefresh,
} from './pull-to-refresh.util';

@Component({
  selector: 'app-pull-to-refresh',
  template: `
    @if (indicatorHeight() > 0 || refreshing()) {
      <div
        class="ptr-indicator d-flex align-items-center justify-content-center"
        [style.height.px]="indicatorHeight()"
        role="status"
        [attr.aria-live]="refreshing() ? 'polite' : 'off'"
        [attr.aria-label]="refreshing() ? ('pullToRefresh.syncing' | transloco) : ('pullToRefresh.release' | transloco)"
      >
        @if (refreshing()) {
          <c-spinner size="sm" color="primary" />
          <span class="ms-2 small text-body-secondary">{{ 'pullToRefresh.syncing' | transloco }}</span>
        } @else if (readyToRelease()) {
          <span class="small text-body-secondary">{{ 'pullToRefresh.release' | transloco }}</span>
        } @else {
          <span class="small text-body-secondary">{{ 'pullToRefresh.pull' | transloco }}</span>
        }
      </div>
    }
  `,
  styles: [
    `
      .ptr-indicator {
        position: fixed;
        top: 3.5rem;
        left: 0;
        right: 0;
        z-index: 1020;
        pointer-events: none;
        transition: height 0.15s ease-out;
      }
    `,
  ],
  imports: [SpinnerComponent, TranslocoPipe],
})
export class PullToRefreshComponent {
  readonly #orderSync = inject(OrderSyncService);
  readonly #onlineState = inject(OnlineStateService);
  readonly #toast = inject(AppToastService);
  readonly #transloco = inject(TranslocoService);

  readonly pullDistance = signal(0);
  readonly refreshing = signal(false);
  readonly readyToRelease = signal(false);
  readonly indicatorHeight = signal(0);

  #touchStartY = 0;
  #tracking = false;

  @HostListener('window:touchstart', ['$event'])
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1 || this.refreshing()) {
      return;
    }
    if (!this.canStartPull()) {
      return;
    }
    this.#touchStartY = event.touches[0].clientY;
    this.#tracking = true;
  }

  @HostListener('window:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (!this.#tracking || event.touches.length !== 1) {
      return;
    }
    if (!this.canStartPull()) {
      this.resetPull();
      return;
    }

    const delta = event.touches[0].clientY - this.#touchStartY;
    const damped = dampPullDistance(delta);
    if (damped <= 0) {
      this.resetPull();
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.pullDistance.set(damped);
    this.indicatorHeight.set(computeIndicatorHeight(damped));
    this.readyToRelease.set(shouldTriggerRefresh(damped));
  }

  @HostListener('window:touchend')
  @HostListener('window:touchcancel')
  onTouchEnd(): void {
    if (!this.#tracking) {
      return;
    }
    this.#tracking = false;

    const distance = this.pullDistance();
    this.resetPull();

    if (!shouldTriggerRefresh(distance)) {
      return;
    }

    void this.runRefresh();
  }

  private canStartPull(): boolean {
    return isPullGestureAllowed({
      scrollY: window.scrollY,
      modalOpen: document.body.classList.contains('modal-open'),
      offcanvasOpen: document.querySelector('.offcanvas.show') !== null,
      refreshing: this.refreshing(),
    });
  }

  private resetPull(): void {
    this.#tracking = false;
    this.pullDistance.set(0);
    this.indicatorHeight.set(0);
    this.readyToRelease.set(false);
  }

  private async runRefresh(): Promise<void> {
    if (this.refreshing()) {
      return;
    }
    if (!this.#onlineState.isOnline) {
      this.#toast.info(
        this.#transloco.translate('pullToRefresh.offline'),
        this.#transloco.translate('common.error'),
        2500,
      );
      return;
    }

    this.refreshing.set(true);
    this.indicatorHeight.set(PTR_TRIGGER_THRESHOLD_PX);
    try {
      await this.#orderSync.refreshRestaurantSnapshot({ force: true });
    } finally {
      this.refreshing.set(false);
      this.indicatorHeight.set(0);
    }
  }
}
