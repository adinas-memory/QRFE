import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
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

    this.#router.events.pipe(
      filter(evt => evt instanceof NavigationEnd),
      take(1)
    ).subscribe(() => {
      const deepest = this.getDeepestChild(this.#router.routerState.root.snapshot);
      const isPublic = deepest?.data?.['public'] === true;

      if (!isPublic) {
        this.#authService.restoreSession().subscribe(() => {
          this.#authService.pingSession(false).subscribe();
        });
      }
    });
  }

}
