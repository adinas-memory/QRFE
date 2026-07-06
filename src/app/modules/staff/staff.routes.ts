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
        path: 'tables',
        redirectTo: 'kitchen',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../../shared/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./manage-orders/manage-orders.component').then(m => m.ManageOrdersComponent),
        data: { title: 'Orders' }
      },
      {
        path: 'table-orders',
        loadComponent: () =>
          import('./table-orders-by-date/table-orders-by-date.component').then(m => m.TableOrdersByDateComponent),
        data: { title: 'Order history' }
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
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./reservation/reservation.component').then(m => m.ReservationComponent),
        data: { title: 'Bookings' }
      },
      {
        path: 'reservations',
        redirectTo: 'bookings',
        pathMatch: 'full'
      }
    ]
  }
];


