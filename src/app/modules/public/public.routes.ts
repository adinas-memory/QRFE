import { Routes } from '@angular/router';
import { AuthGuard } from '../../core/auth/auth.guard';
import { RoleGuard } from '../../core/auth/role.guard';
import { MenuResolver } from '../../core/services/menu-public/menu-resolver.service';
import { nativeRootLoginGuard } from '../../core/guards/native-root-login.guard';

export const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        canMatch: [nativeRootLoginGuard],
        loadComponent: () =>
          import('./landing/landing.component').then(m => m.LandingComponent),
        data: { title: 'Welcome', public: true }
      },
      {
        path: 'faq',
        loadComponent: () =>
          import('./faq/faq-page.component').then(m => m.FaqPageComponent),
        data: { title: 'FAQ', public: true }
      },
      {
        path: 'partners',
        loadComponent: () =>
          import('./partners/partners-page.component').then(m => m.PartnersPageComponent),
        data: { title: 'Partners', public: true }
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./static-public-page/static-public-page.component').then(m => m.StaticPublicPageComponent),
        data: { title: 'Contact', pageId: 'contact', public: true }
      },
      {
        path: 'privacy',
        loadComponent: () =>
          import('./static-public-page/static-public-page.component').then(m => m.StaticPublicPageComponent),
        data: { title: 'Privacy', pageId: 'privacy', public: true }
      },
      {
        path: 'terms',
        loadComponent: () =>
          import('./static-public-page/static-public-page.component').then(m => m.StaticPublicPageComponent),
        data: { title: 'Terms', pageId: 'terms', public: true }
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
        path: 'forgot-password',
        loadComponent: () =>
          import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
        data: { title: 'Forgot Password', public: true }
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
        data: { title: 'Reset Password', public: true }
      },
      {
        path: 'verify-email',
        loadComponent: () =>
          import('./verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
        data: { title: 'Verify Email', public: true }
      },
      {
        path: 'public/restaurant-setup',
        canActivate: [AuthGuard, RoleGuard],
        loadComponent: () =>
          import('./restaurant-setup/restaurant-setup.component').then(
            m => m.RestaurantSetupComponent
          ),
        data: { title: 'Restaurant Setup', roles: ['default'], public: false, skipSessionPing: true }
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
          },
          {
            path: 'order',
            loadComponent: () =>
              import('./order/order.component').then(m => m.OrderComponent),
            data: { title: 'My Order', public: true }
          }
        ]
      }
    ]
  }
];
