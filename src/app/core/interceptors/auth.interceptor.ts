// core/interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, catchError, switchMap, finalize, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private retryCount = 0;
  private readonly maxRetries = 1;

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authReq = req.clone({ withCredentials: true });

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && this.retryCount < this.maxRetries) {
          if (this.isRefreshing) {
            console.warn('[AuthInterceptor] Refresh already in progress — skipping retry');
            return throwError(() => error);
          }

          this.isRefreshing = true;
          this.retryCount++;

          console.info(`[AuthInterceptor] Attempting refresh #${this.retryCount} due to 401`);

          return this.authService.refreshUserContext().pipe(
            switchMap(() => {
              console.info('[AuthInterceptor] Refresh successful — retrying original request');
              return next.handle(authReq);
            }),
            catchError(refreshError => {
              console.error('[AuthInterceptor] Refresh failed — logging out', refreshError);
              this.authService.clearUser();
              return throwError(() => refreshError);
            }),
            finalize(() => {
              this.isRefreshing = false;
            })
          );
        }

        return throwError(() => error);
      })
    );
  }
}
