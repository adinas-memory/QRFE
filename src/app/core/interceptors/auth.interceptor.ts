import { HttpInterceptorFn, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
import { catchError, switchMap, tap, throwError } from 'rxjs';

// #region agent log
const DEBUG_INGEST = 'http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18';
const DEBUG_SESSION = '7379f5';
let refreshAttemptSeq = 0;

function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
): void {
  fetch(DEBUG_INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': DEBUG_SESSION },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function authDebugHeaders(res: { headers: { get(n: string): string | null } }): Record<string, string> {
  return {
    hasAuthCookie: res.headers.get('X-Debug-Has-Auth-Cookie') ?? 'missing',
    hasRefreshCookie: res.headers.get('X-Debug-Has-Refresh-Cookie') ?? 'missing',
    scheme: res.headers.get('X-Debug-Scheme') ?? 'missing',
    setCookieSecure: res.headers.get('X-Debug-SetCookie-Secure') ?? 'missing',
    setCookieName: res.headers.get('X-Debug-SetCookie-Name') ?? 'missing',
  };
}
// #endregion

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isPublic = req.url.includes('/public/');
  const isRefresh = req.url.includes('/refresh-token');
  const isLogin = req.url.includes('/login');

  const request = req.clone({ withCredentials: true });

  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse && (isLogin || isRefresh || req.url.includes('/api/user/ping'))) {
          // #region agent log
          agentLog('H1', 'auth.interceptor.ts:response', 'auth-related HTTP response', {
            url: req.url,
            status: event.status,
            ...authDebugHeaders(event),
          });
          // #endregion
        }
      },
    }),
    catchError((error: HttpErrorResponse) => {
      // #region agent log
      agentLog('H2', 'auth.interceptor.ts:catchError', 'HTTP error in auth interceptor', {
        url: req.url,
        status: error.status,
        isRefresh,
        isLogin,
        isPublic,
        ...authDebugHeaders(error),
      });
      // #endregion

      // NU încercăm refresh pe refresh-token sau login
      if (isRefresh || isLogin) {
        return throwError(() => error);
      }

      if (error.status === 401 && !isPublic) {
        const attempt = ++refreshAttemptSeq;
        // #region agent log
        agentLog('H5', 'auth.interceptor.ts:401', 'triggering refreshUserContext after 401', {
          url: req.url,
          refreshAttempt: attempt,
        });
        // #endregion
        return auth.refreshUserContext().pipe(
          switchMap((user) => {
            // #region agent log
            agentLog('H5', 'auth.interceptor.ts:afterRefresh', 'refresh completed, retrying original request', {
              url: req.url,
              refreshAttempt: attempt,
              refreshReturnedUser: user != null,
            });
            // #endregion
            return next(request);
          }),
          catchError(err => {
            auth.clearUser();
            router.navigate(['/login']);
            return throwError(() => err);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
