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
import { navItems } from './_nav';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserContextModel } from '../../../../core/models/userContextModel';
import { TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

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
    this.navItems = this.getNavItemsForRole(this.userRole);
    this.restaurantName = this.auth.getRestaurantCtx()?.name ?? null;

    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.restaurantName = user?.restaurantName ?? this.auth.getRestaurantCtx()?.name ?? null;
      });

    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.navItems = this.getNavItemsForRole(this.userRole);
      });
  }

  getNavItemsForRole(role: string): INavData[] {
    switch (role) {
      case 'staff':
        return [
          {
            name: 'Kitchen',
            url: '/staff/kitchen',
            iconComponent: { name: 'cil-dinner' }
          },
          {
            name: 'Bar',
            url: '/staff/bar',
            iconComponent: { name: 'cil-drink-alcohol' }
          },
          {
            name: 'Orders',
            url: '/staff/orders',
            iconComponent: { name: 'cil-list' }
          }
        ];
      case 'manager':
        return [
          {
            name: 'Dashboard',
            url: '/manager/dashboard',
            iconComponent: { name: 'cil-speedometer' }
          },
          {
            name: 'Kitchen',
            url: '/staff/kitchen',
            iconComponent: { name: 'cil-dinner' }
          },
          {
            name: 'Bar',
            url: '/staff/bar',
            iconComponent: { name: 'cil-drink-alcohol' }
          },
          {
            name: 'Orders',
            url: '/manager/manage-orders',
            iconComponent: { name: 'cil-list' }
          },
          {
            title: true,
            name: this.transloco.translate('sidebar.manage')
          },
          {
            name: 'Tables',
            url: '/manager/manage-tables',
            iconComponent: { name: 'cil-grid' }
          },
          {
            name: 'Menu',
            url: '/manager/manage-menu',
            iconComponent: { name: 'cil-restaurant' }
          },
          {
            name: 'Staff',
            url: '/manager/manage-staff',
            iconComponent: { name: 'cil-people' }
          },
          {
            name: 'QR Codes',
            url: '/manager/manage-qrs',
            iconComponent: { name: 'cil-qr-code' }
          },
          {
            title: true,
            name: this.transloco.translate('sidebar.reports')
          },
        ];
      case 'gadmin':
        return [
          { 
            name: 'Dashboard',
            url: '/gadmin/dashboard',
            iconComponent: { name: 'cil-speedometer' }            
          },
          { 
            name: 'Subscription Products', 
            url: '/gadmin/manage-subscription-products', 
            iconComponent: { name: 'cil3d' } 
          },          
        ];
      default:
        return [];
    }
  }
}
