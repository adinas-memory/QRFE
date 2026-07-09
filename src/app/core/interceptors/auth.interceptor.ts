import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService, isHttpAuthFailure } from '../auth/auth.service';
import { NativeAuthTokenService } from '../auth/native-auth-token.service';
import { Router } from '@angular/router';
import { SseConnectivityService } from '../offline/sse-connectivity.service';
import { debugLog } from '../offline/debug-log.util';
import { catchError, switchMap, throwError, timeout } from 'rxjs';

const REFRESH_TIMEOUT_MS = 15_000;

/** Set on a retried request so a second 401 does not trigger another refresh loop. */
export const AUTH_RETRIED = new HttpContextToken<boolean>(() => false);

/** Background lock/status polls must not flip global offline on transient status=0. */
export const SKIP_CONNECTIVITY_OFFLINE = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const sseConnectivity = inject(SseConnectivityService);
  const nativeAuthTokens = inject(NativeAuthTokenService);

  const isPublic = req.url.includes('/public/');
  const isRefresh = req.url.includes('/refresh-token');
  const isLogin = req.url.includes('/login');

  const withAuthHeaders = (base: typeof req, retried: boolean) =>
    base.clone({
      context: base.context.set(AUTH_RETRIED, retried),
      withCredentials: true,
      setHeaders: nativeAuthTokens.authHeaders(),
    });

  const request = withAuthHeaders(req, false);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isRefresh || isLogin) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        if (!req.context.get(SKIP_CONNECTIVITY_OFFLINE)) {
          sseConnectivity.reportHttpNetworkFailure();
        }
        return throwError(() => error);
      }

      if (error.status === 401 && !isPublic) {
        if (req.context.get(AUTH_RETRIED)) {
          debugLog('auth', 'auth.interceptor.ts', 'kick to login after retry 401', {
            url: req.url,
            hypothesisId: 'H8-cookie-kickout',
          });
          auth.clearUser();
          router.navigate(['/login']);
          return throwError(() => error);
        }
        // 401 means the API responded — session may be expired while network is fine.
        sseConnectivity.reportStreamActivity('http-401');
        auth.hydrateSessionFromStorageIfNeeded();
        // #region agent log
        debugLog('auth', 'auth.interceptor.ts', '401 before refresh', {
          url: req.url,
          userRole: auth.getUserRole(),
          isAuthenticated: auth.isAuthenticated(),
          hypothesisId: 'H16-refresh-401',
        });
        // #endregion agent log
        let attemptedRetry = false;
        return auth.refreshUserContext({ redirectOnFailure: false }).pipe(
          timeout({ first: REFRESH_TIMEOUT_MS }),
          switchMap((user) => {
            auth.hydrateSessionFromStorageIfNeeded();
            const sessionOk = user != null || auth.isAuthenticated();
            if (!sessionOk) {
              // #region agent log
              debugLog('auth', 'auth.interceptor.ts', 'refresh returned no session', {
                url: req.url,
                hadUser: user != null,
                isAuthenticated: auth.isAuthenticated(),
                hypothesisId: 'H16-refresh-401',
              });
              // #endregion agent log
              return throwError(() => error);
            }
            attemptedRetry = true;
            return next(withAuthHeaders(req, true));
          }),
          catchError(err => {
            if (isHttpAuthFailure(err)) {
              debugLog('auth', 'auth.interceptor.ts', attemptedRetry ? 'kick to login after retry 401' : 'kick to login after refresh failed', {
                url: req.url,
                refreshStatus: (err as HttpErrorResponse)?.status ?? null,
                hadBearerOnRetry: attemptedRetry && Object.keys(nativeAuthTokens.authHeaders()).length > 0,
                hypothesisId: 'H11-ping-cookie-only',
              });
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
