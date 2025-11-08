import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/auth/auth.guard';
import { RoleGuard } from '../../core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./landing/landing.component').then(m => m.LandingComponent),
        data: { title: 'Welcome' }
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./register/register.component').then(m => m.RegisterComponent),
        data: { title: 'Register' }
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./login/login.component').then(m => m.LoginComponent),
        data: { title: 'Login' }
      },
      {
        path: 'restaurant-setup',
        canActivate: [AuthGuard, RoleGuard],
        loadComponent: () =>
          import('./restaurant-setup/restaurant-setup.component').then(
            m => m.RestaurantSetupComponent
          ),
        data: { title: 'Restaurant Setup', roles: ['default'] }
      },
      {
        path: 'payment-success',
        loadComponent: () =>
          import('./payment-success/payment-success.component').then(
            m => m.PaymentSuccessComponent
          ),
        data: { title: 'Payment Success' }
      },
      {
        path: 'payment-failure',
        loadComponent: () =>
          import('./payment-failure/payment-failure.component').then(
            m => m.PaymentFailureComponent
          ),
        data: { title: 'Payment Failure' }
      },
      {
        path: 'menu/:restaurantId/tables/:tableId',
        loadComponent: () =>
          import('./menu/menu.component').then(m => m.MenuComponent),
        data: { title: 'Restaurant Menu' }
      }
    ]
  }
];
