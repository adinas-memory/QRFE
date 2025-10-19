import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const started = Date.now();

    return next.handle(req).pipe(
      tap({
        next: event => {
          const elapsed = Date.now() - started;
        //   console.log(`[HTTP] ${req.method} ${req.urlWithParams} - ${elapsed}ms`);
        },
        error: error => {
          const elapsed = Date.now() - started;
          console.error(`[HTTP ERROR] ${req.method} ${req.urlWithParams} - ${elapsed}ms`, error);
        }
      })
    );
  }
}
