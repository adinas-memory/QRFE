import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/**
 * Native-only UX: skip public landing and go straight to login.
 * Web/PWA keeps the landing page.
 */
export const nativeRootLoginGuard: CanMatchFn = (): boolean | UrlTree => {
  if (!Capacitor.isNativePlatform()) return true;
  const router = inject(Router);
  return router.parseUrl('/login');
};

