import { Component, OnInit } from '@angular/core';
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
  restaurantName: string | null = null;


  constructor(private auth: AuthService, public iconSet: IconSetService) {

  }

  ngOnInit(): void {
    const role = this.auth.getUserSnapshot()?.role ?? 'default';
    this.navItems = this.getNavItemsForRole(role);
    this.restaurantName = this.auth.getRestaurantCtx()
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
            name: 'Bars',
            url: '/manager/manage-bars',
            iconComponent: { name: 'cil-drink-alcohol' }
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
