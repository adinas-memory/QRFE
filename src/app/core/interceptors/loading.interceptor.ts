import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError, timeout } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';

/** Opt out of the global overlay for a specific request (e.g. background poll). */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Rare: force overlay even when URL would be skipped. */
export const FORCE_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Max time one HttpClient call may hold the global spinner. */
const API_REQUEST_TIMEOUT_MS = 25_000;

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
    url.includes('/api/ping-lite') ||
    url.includes('/staff/dashboard/metrics') ||
    url.includes('/staff/tables/get-tables-status') ||
    (url.includes('/staff/menu') && req.method === 'GET') ||
    url.includes('/assets/i18n/')
  );
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  if (shouldSkipGlobalLoading(req)) {
    return next(req);
  }

  const end = loading.beginRequest(req.method, req.url);
  return next(req).pipe(
    timeout({ first: API_REQUEST_TIMEOUT_MS }),
    catchError(err => throwError(() => err)),
    finalize(() => {
      end();
    }),
  );
};
