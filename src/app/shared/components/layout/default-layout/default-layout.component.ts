import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { IconSetService } from '@coreui/icons-angular';
import { IconDirective } from '@coreui/icons-angular';

import {
  INavData,
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
import { navItems } from './_nav';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserContextModel } from '../../../../core/models/userContextModel';
import { TitleCasePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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


  constructor(private auth: AuthService, public iconSet: IconSetService) {

  }

  ngOnInit(): void {
    const role = this.auth.getUserSnapshot()?.role ?? 'default';
    this.navItems = this.getNavItemsForRole(role);
    this.restaurantName = this.auth.getRestaurantCtx()?.name ?? null;

    // Keep header in sync across refresh / restoreSession / refresh-token.
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.restaurantName = user?.restaurantName ?? this.auth.getRestaurantCtx()?.name ?? null;
      });
  }

  getNavItemsForRole(role: string): INavData[] {
    switch (role) {
      case 'staff':
        return [
          {
            name: 'Dashboard',
            url: '/staff/dashboard',
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
            url: '/staff/orders',
            iconComponent: { name: 'cil-list' }
          },
          {
            name: 'Tables',
            url: '/staff/tables',
            iconComponent: { name: 'cil-grid' }
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
          }
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
