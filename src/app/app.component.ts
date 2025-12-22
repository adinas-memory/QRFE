import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { delay, filter, map, take, tap } from 'rxjs/operators';

import { ColorModeService } from '@coreui/angular';
import { IconSetService, } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';
import { AuthService } from './core/auth/auth.service';
import {SpinnerComponent} from "./shared/components/spinner/spinner.component";


@Component({
  selector: 'app-root',
  template: `<app-spinner></app-spinner><router-outlet></router-outlet>`,
  imports: [RouterOutlet, SpinnerComponent],
})
export class AppComponent implements OnInit {
  title = 'CoreUI Angular Admin Template';

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);
  readonly #authService = inject(AuthService);

  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);

  constructor() {
    this.#titleService.setTitle(this.title);

    // iconSet singleton
    this.#iconSetService.icons = { ...iconSubset };
    this.#colorModeService.localStorageItemName.set('coreui-free-angular-admin-template-theme-default');
    this.#colorModeService.eventName.set('ColorSchemeChange');
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

    this.#router.events.pipe(
      filter(evt => evt instanceof NavigationEnd),
      take(1)
    ).subscribe((evt: NavigationEnd) => {
      const deepest = this.getDeepestChild(this.#router.routerState.root.snapshot);
      const isPublic = deepest?.data?.['public'] === true;
      // console.log("isPublic route:", isPublic);

      if (!isPublic) {
        this.#authService.restoreSession().subscribe(user => {
          this.#authService.pingSession(false).subscribe();
        });
      } else {
        console.log('Public route detected, skipping pingSession.');
      }
    });
  }
}
