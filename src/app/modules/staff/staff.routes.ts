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
        path: 'orders',
        loadComponent: () =>
          import('./orders/orders.component').then(m => m.OrdersComponent),
        data: { title: 'Orders' }
      },
      {
        path: 'tables',
        loadComponent: () =>
          import('./tables/tables.component').then(m => m.TablesComponent),
        data: { title: 'Tables' }
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


