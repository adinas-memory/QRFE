import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
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
          import('./gadmin-dashboard/gadmin-dashboard.component').then(m => m.GadminDashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'manage-restaurants',
        loadComponent: () =>
          import('./manage-restaurants/manage-restaurants.component').then(m => m.ManageRestaurantsComponent),
        data: { title: 'Manage Restaurants' }
      },
      {
        path: 'manage-subscription-products',
        loadComponent: () =>
          import('./manage-subscription-products/manage-subscription-products.component').then(m => m.ManageSubscriptionProductsComponent),
        data: { title: 'Create Subscription Products' }
      },
    ]
  }
];