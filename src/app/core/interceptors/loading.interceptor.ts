import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, timeout } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';

/** Opt out of the global overlay for a specific request (e.g. background poll). */
export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Rare: force overlay even when URL would be skipped. */
export const FORCE_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

/** Max time a single HttpClient call may hold the global loading counter. */
const API_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Background / long-lived calls that must not affect the global HttpClient loading counter.
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
    url.includes('/api/ping-lite') ||
    url.includes('/assets/i18n/')
  );
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  if (shouldSkipGlobalLoading(req)) {
    return next(req);
  }

  loading.show(req.method, req.url);
  return next(req).pipe(
    timeout({ first: API_REQUEST_TIMEOUT_MS }),
    finalize(() => {
      loading.hide(req.method, req.url);
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'post-fix-v2',location:'loading.interceptor.ts:finalize',message:'loading finalize',data:{method:req.method,url:req.url.split('?')[0]},timestamp:Date.now(),hypothesisId:'H-HANG'})}).catch(()=>{});
      // #endregion
    }),
  );
};
