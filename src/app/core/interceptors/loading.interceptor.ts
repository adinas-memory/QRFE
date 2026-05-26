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
    url.includes('/assets/i18n/')
  );
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);

  if (shouldSkipGlobalLoading(req.url)) {
    return next(req);
  }

  loading.show();
  return next(req).pipe(
    finalize(() => loading.hide()),
  );
};
