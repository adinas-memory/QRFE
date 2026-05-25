import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';

/** Opt out of the global overlay for a specific request (e.g. background poll). */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Rare: force overlay even when URL would be skipped. */
export const FORCE_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/**
 * Background / long-lived calls that must not affect the global HttpClient loading counter.
 * Everything else (GET, POST, PUT, PATCH, DELETE) shows activity via LoadingService.
 */
function shouldSkipGlobalLoading(req: Parameters<HttpInterceptorFn>[0]): boolean {
  if (req.context.get(FORCE_GLOBAL_LOADING)) {
    return false;
  }
  if (req.context.get(SKIP_GLOBAL_LOADING)) {
    return true;
  }

  const url = req.url;
  return (
    url.includes('/sse') ||
    url.includes('/api/user/ping') ||
    url.includes('/api/user/refresh-token') ||
    url.includes('/api/ping-lite')
  );
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  if (shouldSkipGlobalLoading(req)) {
    return next(req);
  }

  loading.show(req.method, req.url);
  return next(req).pipe(
    finalize(() => {
      loading.hide(req.method, req.url);
    }),
  );
};
