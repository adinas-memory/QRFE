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
        if (req.context.get(AUTH_RETRIED)) {
          // #region agent log
          fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'38fcde'},body:JSON.stringify({sessionId:'38fcde',location:'auth.interceptor.ts:401-retry',message:'logout after second 401',data:{url:req.url,role:auth.getUserRole()},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          auth.clearUser();
          router.navigate(['/login']);
          return throwError(() => error);
        }
        // 401 means the API responded — session may be expired while network is fine.
        onlineState.setOnline();
        auth.hydrateSessionFromStorageIfNeeded();
        return auth.refreshUserContext({ redirectOnFailure: false }).pipe(
          timeout({ first: REFRESH_TIMEOUT_MS }),
          switchMap((user) => {
            auth.hydrateSessionFromStorageIfNeeded();
            const sessionOk = user != null || auth.isAuthenticated();
            if (!sessionOk) {
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
