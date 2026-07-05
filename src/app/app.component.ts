import { AfterViewInit, Component, DestroyRef, effect, HostListener, inject, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, take } from 'rxjs/operators';

import { ColorModeService } from '@coreui/angular';
import { IconSetService, } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';
import { AuthService } from './core/auth/auth.service';
import { SpinnerComponent } from "./shared/components/spinner/spinner.component";
import { OrderSyncService } from './core/services/order-service/order-sync.service';
import { OnlineStateService } from './core/offline/online-state-service';
import { AppToastsComponent } from '../app/shared/components/app-toast/app-toast.component';
import { LoadingService } from './core/services/loading/loading.service';
import { HttpNavigationCancelService } from './core/services/http-navigation-cancel.service';
import { PushRegistrationService } from './core/services/push/push-registration.service';
import { PickupNotificationService } from './core/services/pickup/pickup-notification.service';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { NetworkMonitor } from './core/plugins/network-monitor.plugin';
import { Location } from '@angular/common';
import { SubscriptionService } from './core/services/subscription-service/subscription.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { OfflinePolicyService } from './core/offline/offline-policy.service';
import { OfflineSyncLockService } from './core/offline/offline-sync-lock.service';
import { NetworkMonitorService } from './core/platform/network-monitor.service';
import { navigateToRoleHome } from './core/auth/auth-redirect.util';
import { isAssignedRestaurantId } from './core/auth/restaurant-id.util';


@Component({
  selector: 'app-root',
  standalone: true,
  template: `<div class="offline-wrapper" [class.offline-active]="isOffline || restaurantSyncFrozen">

  <div class="offline-banners-stack">
    @if (isOffline) {
      <div class="offline-banner">
        <span class="blink">{{ offlineBannerKey | transloco }}</span>
      </div>
    }

    @if (restaurantSyncFrozen) {
      <div class="offline-banner restaurant-sync-banner">
        <span class="blink">{{ 'offline.bannerRestaurantSyncLocked' | transloco }}</span>
      </div>
    }
  </div>

  <app-spinner></app-spinner>
  <app-toasts></app-toasts>
  <router-outlet></router-outlet>

  <!-- #region agent log: debug session e48331 — remove after debugging -->
  @if (showDebugExportButton) {
    <button type="button" #debugExportBtn data-debug-export-btn (click)="exportDebugLog()"
      style="position:fixed;top:32px;left:8px;z-index:2147483647;opacity:1;padding:10px 14px;font-size:14px;font-weight:bold;background:#ffeb3b;color:#000;border:3px solid #000;border-radius:6px;">
      EXPORT LOG
    </button>
  }
  <!-- #endregion -->

</div>`,
  imports: [RouterOutlet, SpinnerComponent, AppToastsComponent, TranslocoPipe],
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'U.R.S.';
  private sseStarted = false;
  isOffline = false;
  restaurantSyncFrozen = false;
  offlineBannerKey = 'offline.bannerLimited';
  private navHistory: string[] = [];
  // #region agent log
  readonly showDebugExportButton = Capacitor.isNativePlatform();
  exportDebugLog(): void {
    void NetworkMonitor.shareDebugLog().catch(err => console.warn('[debug] shareDebugLog failed', err));
  }
  // #endregion

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);
  readonly #authService = inject(AuthService);
  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);
  readonly #orderSyncService = inject(OrderSyncService);
  readonly #onlineStateService = inject(OnlineStateService);
  readonly #offlinePolicy = inject(OfflinePolicyService);
  readonly #networkMonitor = inject(NetworkMonitorService);
  readonly #loadingService = inject(LoadingService);
  readonly #httpNavCancel = inject(HttpNavigationCancelService);
  readonly #pushRegistration = inject(PushRegistrationService);
  readonly #pickupNotification = inject(PickupNotificationService);
  readonly #offlineSyncLock = inject(OfflineSyncLockService);
  readonly #location = inject(Location);
  readonly #subscriptionService = inject(SubscriptionService);

  constructor() {
    this.#titleService.setTitle(this.title);

    // iconSet singleton
    this.#iconSetService.icons = { ...iconSubset };
    this.#colorModeService.localStorageItemName.set('coreui-free-angular-admin-template-theme-default');
    this.#colorModeService.eventName.set('ColorSchemeChange');

    effect(() => {
      this.restaurantSyncFrozen = this.#offlinePolicy.shouldFreezeForRestaurantSync();
    });
  }

  // #region agent log
  ngAfterViewInit(): void {
    setTimeout(() => {
      const el = document.querySelector('[data-debug-export-btn]') as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      const style = el ? getComputedStyle(el) : null;
      void NetworkMonitor.writeDebugLog({
        hypothesisId: 'H_B2_5',
        location: 'app.component.ts:ngAfterViewInit',
        message: 'debug export button DOM check',
        dataJson: JSON.stringify({
          found: !!el,
          rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
          display: style?.display ?? null,
          visibility: style?.visibility ?? null,
          zIndex: style?.zIndex ?? null,
          windowInnerWidth: window.innerWidth,
          windowInnerHeight: window.innerHeight,
        }),
      }).catch(() => {});
    }, 500);
  }
  // #endregion

  // prevent refresh in offline mode
  @HostListener('window:beforeunload', ['$event'])
  preventRefreshOffline(event: BeforeUnloadEvent) {
    if (!navigator.onLine) {
      event.preventDefault();
      event.returnValue = '';
    }
  }


  getDeepestChild(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  ngOnInit(): void {
    // #region agent log
    void NetworkMonitor.writeDebugLog({
      hypothesisId: 'H_B2_4',
      location: 'app.component.ts:ngOnInit',
      message: 'platform check at bootstrap',
      dataJson: JSON.stringify({
        isNativePlatform: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
        showDebugExportButton: this.showDebugExportButton,
      }),
    }).catch(() => {});
    // #endregion
    this.#pushRegistration.init();
    this.#pickupNotification.initGlobalAlerts();
    this.initNativeBackButton();
    this.initNativeAppLifecycle();

    this.#onlineStateService.online$.subscribe(isOnline => {
      this.isOffline = !isOnline;
      this.offlineBannerKey = this.#offlinePolicy.canUseFullOffline()
        ? 'offline.bannerPrimary'
        : 'offline.bannerLimited';
    });

    // 4. Restul logicii tale (SSE, routing, session)
    this.#authService.getUserContext()
      .pipe(filter(user => isAssignedRestaurantId(user?.restaurantId ?? null)), take(1))
      .subscribe(user => {
        if (!this.sseStarted) {
          this.sseStarted = true;
          this.#orderSyncService.listenToRestaurantEvents(user!.restaurantId!);
        }
        this.#offlineSyncLock.startRestaurantLockWatch();
        void this.#networkMonitor.syncWithAuthState();
      });

    this.#authService.loggedIn$.subscribe(() => {
      void this.#networkMonitor.syncWithAuthState();
    });

    this.#router.events
      .pipe(
        filter((evt): evt is NavigationStart => evt instanceof NavigationStart),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(evt => {
        this.#httpNavCancel.cancelAll();
        this.#loadingService.reset(`NavigationStart:${evt.url}`);
      });

    this.#router.events
      .pipe(
        filter((evt): evt is NavigationEnd => evt instanceof NavigationEnd),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((evt) => {
        this.navHistory.push(evt.urlAfterRedirects);
        if (this.navHistory.length > 25) this.navHistory.splice(0, this.navHistory.length - 25);

        const deepest = this.getDeepestChild(this.#router.routerState.root.snapshot);
        const isPublic = deepest?.data?.['public'] === true;
        const skipSessionPing = deepest?.data?.['skipSessionPing'] === true;

        if (!isPublic && !skipSessionPing) {
          this.#authService.hydrateSessionFromStorageIfNeeded();
          this.#authService.restoreSession().subscribe(() => {
            this.#authService.pingSession(false).subscribe();
          });
        }
      });
  }

  private initNativeBackButton(): void {
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('backButton', () => {
      const current = this.#router.url ?? '';
      const previous = this.navHistory.length >= 2 ? this.navHistory[this.navHistory.length - 2] : null;

      // If a CoreUI offcanvas is open (e.g. ManageOrders canvas), close it first instead of navigating/exiting.
      try {
        const offcanvasCloseBtn = document.querySelector('.offcanvas.show .btn-close, .offcanvas.show [aria-label="Close"]') as HTMLElement | null;
        const hasOffcanvas = !!document.querySelector('.offcanvas.show');
        if (hasOffcanvas && offcanvasCloseBtn) {
          offcanvasCloseBtn.click();
          return;
        }

        // If a backdrop is stuck without an open offcanvas, clear it.
        const hasBackdrop = !!document.querySelector('.offcanvas-backdrop');
        if (!hasOffcanvas && hasBackdrop) {
          document.querySelectorAll('.offcanvas-backdrop').forEach((el) => el.remove());
          document.body.classList.remove('offcanvas-backdrop');
          document.body.classList.remove('modal-open');
        }
      } catch {
        // ignore
      }

      const isPublicUrl = (u: string | null): boolean => {
        if (!u) return true;
        if (u === '/' || u === '') return true;
        return (
          u.startsWith('/login') ||
          u.startsWith('/register') ||
          u.startsWith('/forgot-password') ||
          u.startsWith('/reset-password') ||
          u.startsWith('/verify-email') ||
          u.startsWith('/faq') ||
          u.startsWith('/public/')
        );
      };

      if (current.startsWith('/login')) {
        if (this.#authService.isAuthenticated()) {
          void navigateToRoleHome(
            this.#router,
            this.#subscriptionService,
            this.#authService.getUserRole(),
          );
          return;
        }
        void App.exitApp();
        return;
      }

      const currentIsProtected = current.startsWith('/staff') || current.startsWith('/manager') || current.startsWith('/gadmin');
      if (currentIsProtected) {
        // Don’t allow backing into public pages (looks like a logout); exit instead.
        if (!previous || isPublicUrl(previous)) {
          void App.exitApp();
          return;
        }
        this.#location.back();
        return;
      }

      // Any other public page: exit instead of drifting in history.
      void App.exitApp();
    });
  }

  private initNativeAppLifecycle(): void {
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !this.#authService.isAuthenticated()) return;
      this.#authService.refreshUserContext({ redirectOnFailure: false }).subscribe();
      this.#onlineStateService.triggerResumeCheck();
    });
  }

}
