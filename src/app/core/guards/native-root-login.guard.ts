import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment, UrlTree } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/**
 * Native-only UX: skip public landing and go straight to login.
 * Web/PWA keeps the landing page.
 *
 * Only intercepts when the segments would match the empty root ('/'), so that
 * navigating to '/login' (or any sibling) never re-triggers the redirect.
 */
export const nativeRootLoginGuard: CanMatchFn = (_route, segments: UrlSegment[]): boolean | UrlTree => {
  if (!Capacitor.isNativePlatform()) return true;
  if (segments.length !== 0) return true;
  const router = inject(Router);
  return router.parseUrl('/login');
};

