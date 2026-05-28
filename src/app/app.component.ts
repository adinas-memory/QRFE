import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
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
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Location } from '@angular/common';


@Component({
  selector: 'app-root',
  standalone: true,
  template: `<div class="offline-wrapper" [class.offline-active]="isOffline">

  @if (isOffline) {
    <div class="offline-banner">
      <span class="blink">NO INTERNET CONNECTION</span>
    </div>
  }

  <!-- #region agent log -->
  <div style="position:fixed;left:0;bottom:0;z-index:2147483647;background:#1b5e20;color:#fff;font:11px/14px monospace;padding:3px 6px;max-width:100vw;white-space:pre-wrap;word-break:break-all;pointer-events:none;">
    [3] AppComponent ngOnInit ran (native={{ dbgIsNative }}) url={{ dbgCurrentUrl }}
    navEvents={{ dbgNavCount }} last={{ dbgLastNav }}
  </div>
  <!-- #endregion agent log -->

  <app-spinner></app-spinner>
  <app-toasts></app-toasts>
  <router-outlet></router-outlet>

</div>`,
  imports: [RouterOutlet, SpinnerComponent, AppToastsComponent],
})
export class AppComponent implements OnInit {
  title = 'U.R.S.';
  private sseStarted = false;
  isOffline = false;
  private navHistory: string[] = [];

  // #region agent log
  dbgIsNative = false;
  dbgCurrentUrl = '(init)';
  dbgNavCount = 0;
  dbgLastNav = '(none)';
  // #endregion agent log

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);
  readonly #authService = inject(AuthService);
  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);
  readonly #orderSyncService = inject(OrderSyncService);
  readonly #onlineStateService = inject(OnlineStateService);
  readonly #loadingService = inject(LoadingService);
  readonly #httpNavCancel = inject(HttpNavigationCancelService);
  readonly #pushRegistration = inject(PushRegistrationService);
  readonly #location = inject(Location);

  constructor() {
    this.#titleService.setTitle(this.title);

    // iconSet singleton
    this.#iconSetService.icons = { ...iconSubset };
    this.#colorModeService.localStorageItemName.set('coreui-free-angular-admin-template-theme-default');
    this.#colorModeService.eventName.set('ColorSchemeChange');
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
    // #region agent log
    try {
      this.dbgIsNative = Capacitor.isNativePlatform();
      this.dbgCurrentUrl = this.#router.url ?? '(no url)';
      const dbg = (window as unknown as { __dbgOverlay?: (id: string, text: string, color: string, top: number) => void }).__dbgOverlay;
      if (dbg) dbg('__dbg_app', '[3] AppComponent ngOnInit native=' + this.dbgIsNative + ' url=' + this.dbgCurrentUrl, '#1b5e20', 100);
    } catch { /* ignore */ }
    // #endregion agent log

    this.#pushRegistration.init();
    this.initNativeBackButton();

    this.#onlineStateService.online$.subscribe(isOnline => {
      this.isOffline = !isOnline;
    });

    // 4. Restul logicii tale (SSE, routing, session)
    this.#authService.getUserContext()
      .pipe(filter(user => !!user?.restaurantId), take(1))
      .subscribe(user => {
        if (!this.sseStarted) {
          this.sseStarted = true;
          this.#orderSyncService.listenToRestaurantEvents(user!.restaurantId!);
        }
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

    // #region agent log
    this.#router.events
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((e) => {
        this.dbgNavCount++;
        this.dbgLastNav = (e.constructor?.name ?? 'evt') + ' ' + ((e as { url?: string }).url ?? '');
        const dbg = (window as unknown as { __dbgOverlay?: (id: string, text: string, color: string, top: number) => void }).__dbgOverlay;
        if (dbg) dbg('__dbg_nav', '[NAV ' + this.dbgNavCount + '] ' + this.dbgLastNav, '#0277bd', 120);
      });
    // #endregion agent log

    this.#router.events
      .pipe(
        filter((evt): evt is NavigationEnd => evt instanceof NavigationEnd),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe((evt) => {
        this.navHistory.push(evt.urlAfterRedirects);
        if (this.navHistory.length > 25) this.navHistory.splice(0, this.navHistory.length - 25);

        // #region agent log
        this.dbgCurrentUrl = evt.urlAfterRedirects;
        // #endregion agent log

        const deepest = this.getDeepestChild(this.#router.routerState.root.snapshot);
        const isPublic = deepest?.data?.['public'] === true;

        if (!isPublic) {
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

}
