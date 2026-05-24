import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService, isHttpAuthFailure } from '../auth/auth.service';
import { Router } from '@angular/router';
import { OnlineStateService } from '../offline/online-state-service';
import { catchError, switchMap, throwError } from 'rxjs';

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
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'auth.interceptor.ts',message:'network_error_no_refresh',data:{url:req.url},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
        return throwError(() => error);
      }

      if (error.status === 401 && !isPublic) {
        if (!onlineState.isOnline) {
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'auth.interceptor.ts',message:'401_skipped_offline',data:{url:req.url},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
          return throwError(() => error);
        }
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'auth.interceptor.ts',message:'401_refresh_attempt',data:{url:req.url},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
        return auth.refreshUserContext().pipe(
          switchMap((user) => {
            if (!user) {
              return throwError(() => error);
            }
            return next(request);
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
