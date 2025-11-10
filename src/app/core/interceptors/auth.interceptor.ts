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
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshInProgress$?: Observable<any>;

  constructor(private authService: AuthService, private router: Router) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isPublicRoute = req.url.includes('/public/');

    const request = req.clone({ withCredentials: true });

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublicRoute) {
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            this.refreshInProgress$ = this.authService.refreshUserContext().pipe(
              finalize(() => {
                this.isRefreshing = false;
                this.refreshInProgress$ = undefined;
              }),
              catchError(err => {
                this.authService.clearUser();
                this.router.navigate(['/login']);
                return throwError(() => err);
              })
            );
          }

          return (this.refreshInProgress$ ?? of(null)).pipe(
            switchMap(() => next.handle(request))
          );
        }

        return throwError(() => error);
      })
    );
  }

}

