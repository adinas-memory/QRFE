import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';
import { RoleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  // Public funnel (standalone routes)
  {
    path: '',
    loadChildren: () =>
      import('./modules/public/public.routes').then(m => m.routes)
  },

  // Staff area
  {
    path: 'staff/:restaurantId',
    loadChildren: () =>
      import('./modules/staff/staff.routes').then(m => m.routes),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['staff', 'manager', 'gadmin'] }
  },

    // // Manager area
  // { path: 'manager', loadChildren: () => import('./modules/manager/manager.routes').then(m => m.routes), canActivate: [AuthGuard, RoleGuard], data: { roles: ['manager'] } },

  // // Global admin area
  // { path: 'admin', loadChildren: () => import('./modules/admin/admin.routes').then(m => m.routes), canActivate: [AuthGuard, RoleGuard], data: { roles: ['admin'] } },

  // Fallbacks
  {
    path: '404',
    loadComponent: () =>
      import('./views/pages/page404/page404.component').then(
        m => m.Page404Component
      )
  },
  { path: '**', redirectTo: '404' }
];


// export const routes: Routes = [
//   {
//     path: '',
//     redirectTo: 'dashboard',
//     pathMatch: 'full'
//   },
//   {
//     path:'',
//     loadChildren: () => import('./modules/public/public.routes').then(m => m.routes),
//     data: {
//       title: 'Public'
//     }
//   },
//   {
//     path: '',
//     loadComponent: () =>
//     import('./shared/components/layout').then(m => m.DefaultLayoutComponent),
//     data: {
//       title: 'Home'
//     },
//     children: [
//       {
//         path: 'dashboard',
//         loadChildren: () => import('./views/dashboard/routes').then((m) => m.routes)
//       },
//       {
//         path: 'theme',
//         loadChildren: () => import('./views/theme/routes').then((m) => m.routes)
//       },
//       {
//         path: 'base',
//         loadChildren: () => import('./views/base/routes').then((m) => m.routes)
//       },
//       {
//         path: 'buttons',
//         loadChildren: () => import('./views/buttons/routes').then((m) => m.routes)
//       },
//       {
//         path: 'forms',
//         loadChildren: () => import('./views/forms/routes').then((m) => m.routes)
//       },
//       {
//         path: 'icons',
//         loadChildren: () => import('./views/icons/routes').then((m) => m.routes)
//       },
//       {
//         path: 'notifications',
//         loadChildren: () => import('./views/notifications/routes').then((m) => m.routes)
//       },
//       {
//         path: 'widgets',
//         loadChildren: () => import('./views/widgets/routes').then((m) => m.routes)
//       },
//       {
//         path: 'charts',
//         loadChildren: () => import('./views/charts/routes').then((m) => m.routes)
//       },
//       {
//         path: 'pages',
//         loadChildren: () => import('./views/pages/routes').then((m) => m.routes)
//       }
//     ]
//   },
//   {
//     path: '404',
//     loadComponent: () => import('./views/pages/page404/page404.component').then(m => m.Page404Component),
//     data: {
//       title: 'Page 404'
//     }
//   },
//   {
//     path: '500',
//     loadComponent: () => import('./views/pages/page500/page500.component').then(m => m.Page500Component),
//     data: {
//       title: 'Page 500'
//     }
//   },
//   {
//     path: 'login',
//     loadComponent: () => import('./views/pages/login/login.component').then(m => m.LoginComponent),
//     data: {
//       title: 'Login Page'
//     }
//   },
//   {
//     path: 'register',
//     loadComponent: () => import('./views/pages/register/register.component').then(m => m.RegisterComponent),
//     data: {
//       title: 'Register Page'
//     }
//   },
//   { path: '**', redirectTo: 'dashboard' }
// ];
