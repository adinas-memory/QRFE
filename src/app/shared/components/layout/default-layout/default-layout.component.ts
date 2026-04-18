import { Component, OnInit, DestroyRef, inject, computed } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { IconSetService } from '@coreui/icons-angular';
import { IconDirective } from '@coreui/icons-angular';

import {
  INavData,
  ColorModeService,
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective,
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { FeedbackModalComponent } from '@app/shared/components/feedback/feedback-modal.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, of, switchMap } from 'rxjs';

function isOverflown(element: HTMLElement) {
  return (
    element.scrollHeight > element.clientHeight ||
    element.scrollWidth > element.clientWidth
  );
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    ContainerComponent,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    FeedbackModalComponent,
    IconDirective,
    NgScrollbar,
    RouterOutlet,
    RouterLink,
    ShadowOnScrollDirective,
    TitleCasePipe
  ]
})
export class DefaultLayoutComponent implements OnInit {
  public navItems: INavData[] = [];
  restaurantName: string | any| null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  readonly #colorModeService = inject(ColorModeService);
  readonly #colorMode = this.#colorModeService.colorMode;

  readonly sidebarColorScheme = computed<'dark' | 'light'>(() => {
    const mode = this.#colorMode();
    if (mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode as 'dark' | 'light';
  });

  private userRole = 'default';

  constructor(private auth: AuthService, public iconSet: IconSetService) {}

  ngOnInit(): void {
    this.userRole = this.auth.getUserSnapshot()?.role ?? 'default';
    this.restaurantName = this.auth.getRestaurantCtx()?.name ?? null;

    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.restaurantName = user?.restaurantName ?? this.auth.getRestaurantCtx()?.name ?? null;
      });

    // Wait for translation files before translate(); avoids raw keys (e.g. sidebar.manage) on slow/async loads (Edge).
    const afterLangReady$ = this.transloco.load(this.transloco.getActiveLang()).pipe(catchError(() => of(undefined)));

    afterLangReady$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.navItems = this.getNavItemsForRole(this.userRole);
    });

    this.transloco.langChanges$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.transloco.load(this.transloco.getActiveLang()).pipe(catchError(() => of(undefined)))
        )
      )
      .subscribe(() => {
        this.navItems = this.getNavItemsForRole(this.userRole);
      });
  }

  getNavItemsForRole(role: string): INavData[] {
    switch (role) {
      case 'staff':
        return [
          {
            name: this.transloco.translate('nav.dashboard'),
            url: '/staff/dashboard',
            iconComponent: { name: 'cil-speedometer' }
          },
          {
            name: this.transloco.translate('nav.orders'),
            url: '/staff/orders',
            iconComponent: { name: 'cil-list' }
          },
          {
            name: this.transloco.translate('nav.kitchen'),
            url: '/staff/kitchen',
            iconComponent: { name: 'cil-dinner' }
          },
          {
            name: this.transloco.translate('nav.bar'),
            url: '/staff/bar',
            iconComponent: { name: 'cil-drink-alcohol' }
          },
          {
            name: this.transloco.translate('nav.bookings'),
            url: '/staff/bookings',
            iconComponent: { name: 'cilCalendar' }
          }
        ];
      case 'manager':
        return [
          {
            name: this.transloco.translate('nav.dashboard'),
            url: '/manager/dashboard',
            iconComponent: { name: 'cil-speedometer' }
          },
          {
            name: this.transloco.translate('nav.orders'),
            url: '/manager/manage-orders',
            iconComponent: { name: 'cil-list' }
          },
          {
            name: this.transloco.translate('nav.kitchen'),
            url: '/staff/kitchen',
            iconComponent: { name: 'cil-dinner' }
          },
          {
            name: this.transloco.translate('nav.bar'),
            url: '/staff/bar',
            iconComponent: { name: 'cil-drink-alcohol' }
          },
          {
            name: this.transloco.translate('nav.bookings'),
            url: '/staff/bookings',
            iconComponent: { name: 'cilCalendar' }
          },
          {
            title: true,
            name: this.transloco.translate('sidebar.manage')
          },
          {
            name: this.transloco.translate('nav.tables'),
            url: '/manager/manage-tables',
            iconComponent: { name: 'cil-grid' }
          },
          {
            name: this.transloco.translate('nav.menu'),
            url: '/manager/manage-menu',
            iconComponent: { name: 'cil-restaurant' }
          },
          {
            name: this.transloco.translate('nav.staff'),
            url: '/manager/manage-staff',
            iconComponent: { name: 'cil-people' }
          },
          {
            name: this.transloco.translate('nav.qrCodes'),
            url: '/manager/manage-qrs',
            iconComponent: { name: 'cil-qr-code' }
          },
          {
            title: true,
            name: this.transloco.translate('sidebar.reports')
          },
          {
            name: this.transloco.translate('sidebar.loginLogoutReport'),
            url: '/manager/reports/login-logout',
            iconComponent: { name: 'cil-notes' }
          },
          {
            name: this.transloco.translate('sidebar.salesReports'),
            url: '/manager/reports/sales',
            iconComponent: { name: 'cil-chart' }
          }
        ];
      case 'gadmin':
        return [
          { 
            name: this.transloco.translate('nav.dashboard'),
            url: '/gadmin/dashboard',
            iconComponent: { name: 'cil-speedometer' }            
          },
          {
            name: this.transloco.translate('nav.bookings'),
            url: '/staff/bookings',
            iconComponent: { name: 'cilCalendar' }
          },
          { 
            name: this.transloco.translate('nav.subscriptionProducts'), 
            url: '/gadmin/manage-subscription-products', 
            iconComponent: { name: 'cil3d' } 
          },          
        ];
      default:
        return [];
    }
  }
}
