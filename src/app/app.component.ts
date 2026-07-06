import { Component, DestroyRef, effect, HostListener, inject, OnInit } from '@angular/core';
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
import { Location } from '@angular/common';
import { SubscriptionService } from './core/services/subscription-service/subscription.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { OfflinePolicyService } from './core/offline/offline-policy.service';
import { OfflineSyncLockService } from './core/offline/offline-sync-lock.service';
import { NetworkMonitorService } from './core/platform/network-monitor.service';
import { navigateToRoleHome } from './core/auth/auth-redirect.util';
import { isAssignedRestaurantId } from './core/auth/restaurant-id.util';
import { environment } from '../environments/environment';
import { NetworkMonitor } from './core/plugins/network-monitor.plugin';
import { debugLog, downloadWebDebugLog } from './core/offline/debug-log.util';


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

  @if (showDebugExportButton) {
    <button type="button" data-debug-export-btn (click)="exportDebugLog()"
      style="position:fixed;bottom:16px;right:16px;z-index:2147483647;opacity:1;padding:10px 14px;font-size:14px;font-weight:bold;background:#ffeb3b;color:#000;border:3px solid #000;border-radius:6px;">
      EXPORT LOG
    </button>
  }

</div>`,
  imports: [RouterOutlet, SpinnerComponent, AppToastsComponent, TranslocoPipe],
})
export class AppComponent implements OnInit {
  title = 'U.R.S.';
  private sseStarted = false;
  isOffline = false;
  restaurantSyncFrozen = false;
  offlineBannerKey = 'offline.bannerLimited';
  private navHistory: string[] = [];
  readonly showDebugExportButton = Capacitor.isNativePlatform();

  exportDebugLog(): void {
    if (Capacitor.isNativePlatform()) {
      void NetworkMonitor.shareDebugLog().catch(err => console.warn('[debug] shareDebugLog failed', err));
      return;
    }
    downloadWebDebugLog();
  }

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
    debugLog('startup', 'app.component.ts:ngOnInit', 'app startup', {
      apiUrl: environment.apiUrl,
      poweredBy: environment.poweredBy,
      native: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
      href: typeof window !== 'undefined' ? window.location.href : null,
      pageProtocol: typeof window !== 'undefined' ? window.location.protocol : null,
    });
    if (Capacitor.isNativePlatform()) {
      void this.#onlineStateService.confirmConnectivity(true);
    }
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
