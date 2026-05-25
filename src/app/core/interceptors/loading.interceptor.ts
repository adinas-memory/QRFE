import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';

function shouldSkipGlobalLoading(url: string): boolean {
  return (
    url.includes('/sse') ||
    url.includes('/api/user/ping') ||
    url.includes('/api/user/refresh-token') ||
    url.includes('/api/ping-lite') ||
    url.includes('/staff/dashboard/metrics') ||
    url.includes('/assets/i18n/')
  );
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const skip = shouldSkipGlobalLoading(req.url);

  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
    body: JSON.stringify({
      sessionId: '7379f5',
      runId: 'spinner-fix',
      location: 'loading.interceptor.ts:request',
      message: skip ? 'loading skipped' : 'loading show',
      data: { url: req.url, skip },
      timestamp: Date.now(),
      hypothesisId: 'H-S2',
    }),
  }).catch(() => {});
  // #endregion

  if (skip) {
    return next(req);
  }

  loading.show();
  return next(req).pipe(
    finalize(() => {
      loading.hide();
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
        body: JSON.stringify({
          sessionId: '7379f5',
          runId: 'spinner-fix',
          location: 'loading.interceptor.ts:finalize',
          message: 'loading hide',
          data: { url: req.url },
          timestamp: Date.now(),
          hypothesisId: 'H-S1',
        }),
      }).catch(() => {});
      // #endregion
    }),
  );
};