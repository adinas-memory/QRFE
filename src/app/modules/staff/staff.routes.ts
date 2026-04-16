import { Routes } from '@angular/router';

// staff.routes.ts
// staff.routes.ts
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/layout').then(m => m.DefaultLayoutComponent),
    data: { title: 'Staff Area' },
    children: [
      {
        path: '',
        redirectTo: 'kitchen',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        redirectTo: 'kitchen',
        pathMatch: 'full'
      },
      {
        path: 'tables',
        redirectTo: 'kitchen',
        pathMatch: 'full'
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./manage-orders/manage-orders.component').then(m => m.ManageOrdersComponent),
        data: { title: 'Orders' }
      },
      {
        path: 'kitchen',
        loadComponent: () =>
          import('./kitchen/kitchen.component').then(m => m.KitchenComponent),
        data: { title: 'Kitchen' }
      },
      {
        path: 'bar',
        loadComponent: () =>
          import('./bar/bar.component').then(m => m.BarComponent),
        data: { title: 'Bar' }
      }
    ]
  }
];


