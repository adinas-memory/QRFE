// role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const userRoles = authService.getUserRoles() ?? []; // e.g. ['staff']
  const restaurantId = route.params?.['restaurantId'];

  // 1. Role check
  if (requiredRoles?.length) {
    const hasRole = requiredRoles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return router.createUrlTree(['/404']); // unauthorized
    }
  }

  // 2. Tenant check
  const tenantAwareRoles = ['default','staff', 'auditor']; // roles that require tenant scoping
  const tenantBypassRoles = ['manager', 'gadmin']; // roles that skip tenant check

  const requiresTenantCheck = !!restaurantId && userRoles.some(role => tenantAwareRoles.includes(role));
  const shouldBypassTenantCheck = userRoles.some(role => tenantBypassRoles.includes(role));

  if (requiresTenantCheck && !shouldBypassTenantCheck) {
  const userRestaurantId = authService.getUserRestaurantId();
  if (!userRestaurantId || userRestaurantId !== restaurantId) {
      return router.createUrlTree(['/404']); // tenant mismatch
    }


  }

  return true;

};
