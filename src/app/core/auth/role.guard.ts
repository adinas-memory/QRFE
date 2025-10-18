// role.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const userRoles = authService.getUserRoles(); // e.g. ['staff']

   // Tenant context (restaurantId from route params)
  const restaurantId = route.params?.['restaurantId'];
  const userTenantIds = authService.getUserRestaurantIds(); // e.g. ['resto123', 'resto456']

  // 1. Role check
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = requiredRoles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return router.createUrlTree(['/404']); // unauthorized
    }
  }

  // 2. Tenant check (only if route has a restaurantId param)
  if (restaurantId) {
    const hasTenantAccess = userTenantIds.includes(restaurantId);
    if (!hasTenantAccess) {
      return router.createUrlTree(['/404']); // tenant mismatch
    }
  }

  return true;
};
