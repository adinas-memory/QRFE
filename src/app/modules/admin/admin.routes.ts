import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/layout').then(m => m.DefaultLayoutComponent),
    data: { title: 'Global Admin Area' },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../../shared/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'create-sucscription-products',
        loadComponent: () =>
          import('./create-subscription-products/create-subscription-products.component').then(m => m.CreateSubscriptionProductsComponent),
        data: { title: 'Create Subscription Products' }
      },
    ]
  }
];