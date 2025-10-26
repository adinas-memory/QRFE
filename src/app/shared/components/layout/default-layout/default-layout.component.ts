import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';

import { IconDirective } from '@coreui/icons-angular';
import {
  ContainerComponent,
  ShadowOnScrollDirective,
  SidebarBrandComponent,
  SidebarComponent,
  SidebarFooterComponent,
  SidebarHeaderComponent,
  SidebarNavComponent,
  SidebarToggleDirective,
  SidebarTogglerDirective
} from '@coreui/angular';

import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { navItems } from './_nav';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserContextModel } from '../../../../core/models/userContextModel';

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
    ShadowOnScrollDirective
  ]
})
export class DefaultLayoutComponent {
  // public navItems = [...navItems];
  public navItems = [{}];
  private user: UserContextModel | null = null;


    constructor(private auth: AuthService) {
    const role = this.auth.getUserSnapshot()?.role ?? 'default';
    this.navItems = this.getNavItemsForRole(role);
  }

    getNavItemsForRole(role: string) {
    switch (role) {
      case 'staff':
        return [
          { name: 'Dashboard', url: '/staff/dashboard', icon: 'cil-speedometer' },
          { name: 'Orders', url: '/staff/orders', icon: 'cil-list' },
          { name: 'Tables', url: '/staff/tables', icon: 'cil-grid' }
        ];
      case 'manager':
        return [
          { name: 'Dashboard', url: '/manager/dashboard', icon: 'cil-speedometer' },
          { name: 'Orders', url: '/manager/manage-orders', icon: 'cil-restaurant' },
          { name: 'Tables', url: '/manager/manage-tables', icon: 'cil-restaurant' },
          { name: 'Menu', url: '/manager/manage-menu', icon: 'cil-restaurant' },
          { name: 'Bars', url: '/manager/manage-bars', icon: 'cil-restaurant' },
          { name: 'Staff', url: '/manager/manage-staff', icon: 'cil-restaurant' },
          { name: 'QR Codes', url: '/manager/manage-qrs', icon: 'cil-restaurant' }
        ];
      case 'gadmin':
        return [
          { name: 'Dashboard', url: '/gadmin/dashboard', icon: 'cil-speedometer' },
          { name: 'Users', url: '/gadmin/users', icon: 'cil-people' },
          { name: 'Settings', url: '/gadmin/settings', icon: 'cil-settings' }
        ];
      default:
        return [];
    }
  }


}
