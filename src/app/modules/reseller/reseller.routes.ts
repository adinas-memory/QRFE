import { Routes } from '@angular/router';

export const resellerRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../shared/components/layout').then(m => m.DefaultLayoutComponent),
    data: { title: 'Reseller Area' },
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./reseller-dashboard/reseller-dashboard.component').then(m => m.ResellerDashboardComponent),
        data: { title: 'Dashboard' }
      },
      {
        path: 'manage-restaurants',
        loadComponent: () =>
          import('./reseller-manage-restaurants/reseller-manage-restaurants.component').then(
            m => m.ResellerManageRestaurantsComponent
          ),
        data: { title: 'Add restaurant' }
      },
      {
        path: 'restaurants/:restaurantId/settings',
        loadComponent: () =>
          import('../manager/manager-settings/manager-settings.component').then(m => m.ManagerSettingsComponent),
        data: { title: 'Restaurant settings' }
      }
    ]
  }
];
