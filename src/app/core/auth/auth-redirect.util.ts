import { Router } from '@angular/router';
import { SubscriptionService } from '../services/subscription-service/subscription.service';

/** Longest-prefix first so `/public/restaurant-setup` wins over `/public`. */
const PROTECTED_ROUTE_ROLES: readonly { prefix: string; roles: readonly string[] }[] = [
  { prefix: '/public/restaurant-setup', roles: ['default'] },
  { prefix: '/reseller', roles: ['reseller'] },
  { prefix: '/gadmin', roles: ['gadmin'] },
  { prefix: '/manager', roles: ['manager', 'gadmin'] },
  { prefix: '/staff', roles: ['staff', 'manager', 'gadmin'] },
];

const AUTH_LOOP_PATHS = new Set(['/login', '/register']);

/** Default post-login route for a role (shared by login, native guard, auto-resume). */
export function getRoleHomeUrl(role: string | null | undefined, pendingPlan: boolean): string {
  if (role === 'default' && pendingPlan) return '/public/restaurant-setup';
  if (role === 'default') return '/';
  if (role === 'staff') return '/staff';
  if (role === 'manager') return '/manager';
  if (role === 'gadmin') return '/gadmin';
  if (role === 'reseller') return '/reseller';
  if (pendingPlan && !role) return '/register';
  return '/register';
}

/** Reject open redirects and auth-loop targets. */
export function sanitizeReturnUrl(returnUrl: string | null | undefined): string | null {
  if (!returnUrl?.trim()) {
    return null;
  }
  const trimmed = returnUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  const path = trimmed.split('?')[0]?.split('#')[0] ?? '';
  if (AUTH_LOOP_PATHS.has(path)) {
    return null;
  }
  return trimmed;
}

/** Whether an authenticated user with `role` may open `returnUrl`. */
export function isReturnUrlAllowedForRole(returnUrl: string, role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  const path = returnUrl.split('?')[0]?.split('#')[0] ?? '';
  for (const { prefix, roles } of PROTECTED_ROUTE_ROLES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return roles.includes(role);
    }
  }
  return true;
}

/** Pick returnUrl when role matches, otherwise the default home for that role. */
export function resolvePostLoginUrl(
  role: string | null | undefined,
  pendingPlan: boolean,
  returnUrl?: string | null,
): string {
  const sanitized = sanitizeReturnUrl(returnUrl);
  if (sanitized && isReturnUrlAllowedForRole(sanitized, role)) {
    return sanitized;
  }
  return getRoleHomeUrl(role, pendingPlan);
}

export async function navigateToRoleHome(
  router: Router,
  subscriptionService: SubscriptionService,
  role: string | null | undefined,
  returnUrl?: string | null,
): Promise<void> {
  const pending = !!subscriptionService.getPendingPlan();
  const url = resolvePostLoginUrl(role, pending, returnUrl);
  await router.navigateByUrl(url);
}
