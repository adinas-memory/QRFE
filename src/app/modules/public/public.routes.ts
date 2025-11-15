import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/auth/auth.guard';
import { RoleGuard } from '../../core/auth/role.guard';
import { MenuResolver } from '../../core/services/menu-public/menu-resolver.service';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./landing/landing.component').then(m => m.LandingComponent),
        data: { title: 'Welcome', public: true }
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./register/register.component').then(m => m.RegisterComponent),
        data: { title: 'Register', public: true }
      },
      {
        path: 'login',
        loadComponent: () =>
          import('./login/login.component').then(m => m.LoginComponent),
        data: { title: 'Login', public: true }
      },
      {
        path: 'public/restaurant-setup',
        canActivate: [AuthGuard, RoleGuard],
        loadComponent: () =>
          import('./restaurant-setup/restaurant-setup.component').then(
            m => m.RestaurantSetupComponent
          ),
        data: { title: 'Restaurant Setup', roles: ['default'] }
      },
      {
        path: 'public/payment-success',
        loadComponent: () =>
          import('./payment-success/payment-success.component').then(
            m => m.PaymentSuccessComponent
          ),
        data: { title: 'Payment Success', public: true }
      },
      {
        path: 'public/payment-failure',
        loadComponent: () =>
          import('./payment-failure/payment-failure.component').then(
            m => m.PaymentFailureComponent
          ),
        data: { title: 'Payment Failure', public: true }
      },
      {
        path: 'public/menu/:restaurantId/tables/:tableId',
        loadComponent: () =>
          import('./public-layout/public-layout.component').then(m => m.PublicLayoutComponent),
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./menu/menu.component').then(m => m.MenuComponent),
            resolve: {
              menuData: MenuResolver
            },
            data: { title: 'Restaurant Menu', public: true }
          }
        ]
      }
    ]
  }
];
