// role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const userRole = authService.getUserRole(); // single string or null
  const restaurantId = route.params?.['restaurantId'];

  // 1. Role check
  if (requiredRoles?.length) {
    if (!userRole || !requiredRoles.includes(userRole)) {
      return router.createUrlTree(['/register']); // unauthorized
    }
  }

  // 2. Tenant check
  const tenantAwareRoles = ['staff', 'auditor']; // roles that require tenant scoping
  const tenantBypassRoles = ['manager', 'gadmin']; // roles that skip tenant check

  const requiresTenantCheck = !!restaurantId && userRole && tenantAwareRoles.includes(userRole);
  const shouldBypassTenantCheck = userRole && tenantBypassRoles.includes(userRole);

  if (requiresTenantCheck && !shouldBypassTenantCheck) {
    const userRestaurantId = authService.getUserRestaurantId();
    if (!userRestaurantId || userRestaurantId !== restaurantId) {
      return router.createUrlTree(['/404']); // tenant mismatch
    }
  }

  return true;
};

