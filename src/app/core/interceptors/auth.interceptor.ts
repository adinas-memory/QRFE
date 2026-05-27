import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService, isHttpAuthFailure } from '../auth/auth.service';
import { Router } from '@angular/router';
import { OnlineStateService } from '../offline/online-state-service';
import { catchError, switchMap, throwError, timeout } from 'rxjs';

const REFRESH_TIMEOUT_MS = 15_000;

/** Set on a retried request so a second 401 does not trigger another refresh loop. */
export const AUTH_RETRIED = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const onlineState = inject(OnlineStateService);

  const isPublic = req.url.includes('/public/');
  const isRefresh = req.url.includes('/refresh-token');
  const isLogin = req.url.includes('/login');

  const request = req.clone({ withCredentials: true });

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isRefresh || isLogin) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        onlineState.setOffline();
        return throwError(() => error);
      }

      if (error.status === 401 && !isPublic) {
        if (!onlineState.isOnline) {
          return throwError(() => error);
        }
        if (req.context.get(AUTH_RETRIED)) {
          auth.clearUser();
          router.navigate(['/login']);
          return throwError(() => error);
        }
        return auth.refreshUserContext().pipe(
          timeout({ first: REFRESH_TIMEOUT_MS }),
          switchMap((user) => {
            if (!user) {
              return throwError(() => error);
            }
            return next(req.clone({ context: req.context.set(AUTH_RETRIED, true) }));
          }),
          catchError(err => {
            if (isHttpAuthFailure(err)) {
              auth.clearUser();
              router.navigate(['/login']);
            }
            return throwError(() => err);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
