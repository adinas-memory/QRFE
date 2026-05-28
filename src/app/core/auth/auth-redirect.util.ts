import { Router } from '@angular/router';
import { SubscriptionService } from '../services/subscription-service/subscription.service';

/** Default post-login route for a role (shared by login, native guard, auto-resume). */
export function getRoleHomeUrl(role: string | null | undefined, pendingPlan: boolean): string {
  if (role === 'default' && pendingPlan) return '/public/restaurant-setup';
  if (role === 'default') return '/';
  if (role === 'staff') return '/staff';
  if (role === 'manager') return '/manager';
  if (role === 'gadmin') return '/gadmin';
  if (pendingPlan && !role) return '/register';
  return '/register';
}

export async function navigateToRoleHome(
  router: Router,
  subscriptionService: SubscriptionService,
  role: string | null | undefined,
  returnUrl?: string | null,
): Promise<void> {
  if (returnUrl) {
    await router.navigateByUrl(returnUrl);
    return;
  }
  const pending = !!subscriptionService.getPendingPlan();
  const url = getRoleHomeUrl(role, pending);
  await router.navigateByUrl(url);
}
