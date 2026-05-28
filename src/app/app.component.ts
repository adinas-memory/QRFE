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
