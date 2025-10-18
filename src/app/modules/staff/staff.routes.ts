import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    children: [
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
    ]
  }
];
