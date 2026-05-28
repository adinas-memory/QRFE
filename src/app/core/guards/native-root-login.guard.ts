import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment, UrlTree } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../auth/auth.service';
import { SubscriptionService } from '../services/subscription-service/subscription.service';
import { getRoleHomeUrl } from '../auth/auth-redirect.util';

/**
 * Native-only UX: skip public landing — authenticated users go to role home, others to login.
 * Web/PWA keeps the landing page.
 *
 * Only intercepts when the segments would match the empty root ('/'), so that
 * navigating to '/login' (or any sibling) never re-triggers the redirect.
 */
export const nativeRootLoginGuard: CanMatchFn = (_route, segments: UrlSegment[]): boolean | UrlTree => {
  if (!Capacitor.isNativePlatform()) return true;
  if (segments.length !== 0) return true;

  const authService = inject(AuthService);
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const role = authService.getUserRole();
    const pendingPlan = !!subscriptionService.getPendingPlan();
    return router.parseUrl(getRoleHomeUrl(role, pendingPlan));
  }

  return router.parseUrl('/login');
};

