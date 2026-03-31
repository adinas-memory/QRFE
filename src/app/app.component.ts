import { Component, DestroyRef, HostListener, inject, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { delay, filter, map, take, tap } from 'rxjs/operators';

import { ColorModeService } from '@coreui/angular';
import { IconSetService, } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';
import { AuthService } from './core/auth/auth.service';
import { SpinnerComponent } from "./shared/components/spinner/spinner.component";
import { OfflineQueueProcessor } from './core/offline/offline-queue-processor.service';
import { OrderSyncService } from './core/services/order-service/order-sync.service';
import { MiscellaneousService } from './core/services/misc/miscellaneous.service';


@Component({
  selector: 'app-root',
  template: `<app-spinner></app-spinner><router-outlet></router-outlet>`,
  imports: [RouterOutlet, SpinnerComponent],
})
export class AppComponent implements OnInit {
  title = 'CoreUI Angular Admin Template';
  private sseStarted = false;

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);
  readonly #authService = inject(AuthService);  
  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);
  readonly #orderSyncService = inject(OrderSyncService);
 

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
    const keyTheme = 'coreui-free-angular-admin-template-theme-default';
    const defaultValue = '"dark"';
    localStorage.setItem(keyTheme, defaultValue);

    // 1. Detectăm tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[APP] Tab hidden → ignore offline events');
      }
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
      } else {
        console.log('Public route detected, skipping pingSession.');
      }
    });
  }

}
