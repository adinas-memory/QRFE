import { HttpInterceptorFn, HttpRequest, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AppToastService } from '../services/toast-service/toast-service.service';
import { MiscellaneousService } from '../services/misc/miscellaneous.service';
import { TranslocoService } from '@jsverse/transloco';

/** Set on a request to skip the global error toast (handle in the caller). */
export const SKIP_HTTP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

function shouldSkipGlobalToast(req: HttpRequest<unknown>, err: HttpErrorResponse): boolean {
  if (req.context.get(SKIP_HTTP_ERROR_TOAST)) {
    return true;
  }
  const u = req.url;
  if (u.includes('/api/user/login') || u.includes('/api/user/register')) {
    return true;
  }
  if (u.includes('/api/user/refresh-token') || u.includes('/api/user/ping')) {
    return true;
  }
  // Auth interceptor may retry; avoid noisy toast before refresh completes.
  if (err.status === 401) {
    return true;
  }
  return false;
}

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(AppToastService);
  const misc = inject(MiscellaneousService);
  const transloco = inject(TranslocoService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!shouldSkipGlobalToast(req, err)) {
        console.error('HTTP error', req.method, req.url, err);
        toast.error(misc.getFirstErrorMessage(err), transloco.translate('common.requestFailed'));
      }
      return throwError(() => err);
    })
  );
};
