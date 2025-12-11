import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';
import { RoleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./modules/public/public.routes').then(m => m.routes)
  },
  {
    path: 'staff',
    loadChildren: () =>
      import('./modules/staff/staff.routes').then(m => m.routes),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['staff', 'manager', 'gadmin'] }
  },
  {
    path: 'manager',
    loadChildren: () =>
      import('./modules/manager/manager.routes').then(m => m.routes),
    // canActivate: [AuthGuard, RoleGuard],
    // data: { roles: ['manager', 'gadmin'] }
  },
  {
    path: 'global-admin',
    loadChildren: () =>
      import('./modules/staff/staff.routes').then(m => m.routes),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['gadmin'] }
  }
];
