import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const RoleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const requiredRoles = normalizeRoles(route.data?.['roles']);
  const userRole = authService.getUserRole(); // single string or null
  const restaurantId = route.params?.['restaurantId'];

  // 1. Role check
  if (requiredRoles.length > 0) {
    if (!userRole || !requiredRoles.includes(userRole)) {
      console.warn(`RoleGuard: Unauthorized role '${userRole}', expected one of: ${requiredRoles.join(', ')}`);
      return router.createUrlTree(['/register']);
    }
  }

  // 2. Tenant check
  const tenantAwareRoles = ['staff', 'auditor'];
  const tenantBypassRoles = ['manager', 'gadmin'];

  const requiresTenantCheck = !!restaurantId && userRole && tenantAwareRoles.includes(userRole);
  const shouldBypassTenantCheck = userRole && tenantBypassRoles.includes(userRole);

  if (requiresTenantCheck && !shouldBypassTenantCheck) {
    const userRestaurantId = authService.getUserRestaurantId();
    if (!userRestaurantId || userRestaurantId !== restaurantId) {
      console.warn(`RoleGuard: Tenant mismatch. UserRestaurantId=${userRestaurantId}, RouteRestaurantId=${restaurantId}`);
      return router.createUrlTree(['/404']);
    }
  }

  return true;
};

//Helper to normalize roles
function normalizeRoles(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input.filter(r => typeof r === 'string');
  return [];
}
