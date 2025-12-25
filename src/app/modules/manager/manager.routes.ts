import { Routes } from '@angular/router';


export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/layout').then(m => m.DefaultLayoutComponent),
    data: { title: 'Manager Area' },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'manage-orders',
        loadComponent: () =>
          import('../staff/manage-orders/manage-orders.component').then(m => m.ManageOrdersComponent),
        data: { title: 'Orders' }
      },
      {
        path: 'manage-tables',
        loadComponent: () =>
          import('./manage-tables/manage-tables.component').then(m => m.ManageTablesComponent),
        data: { title: 'Staff' }
      },
      {
        path: 'manage-menu',
        loadComponent: () =>
          import('./manage-menu/manage-menu.component').then(m => m.ManageMenuComponent),
        data: { title: 'Menu' }
      },
      {
        path: 'manage-bars',
        loadComponent: () =>
          import('./manage-bars/manage-bars.component').then(m => m.ManageBarsComponent),
        data: { title: 'Bars' }
      },
      {
        path: 'manage-staff',
        loadComponent: () =>
          import('./manage-staff/manage-staff.component').then(m => m.ManageStaffComponent),
        data: { title: 'Staff' }
      },
      {
        path: 'manage-qrs',
        loadComponent: () =>
          import('./manage-qrs/manage-qrs.component').then(m => m.ManageQrsComponent),
        data: { title: 'QR Codes' }
      }
    ]
  }
];
