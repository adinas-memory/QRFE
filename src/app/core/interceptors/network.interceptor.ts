import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable, throwError, catchError } from "rxjs";
import { OnlineStateService } from "../offline/online-state-service";

@Injectable()
export class NetworkInterceptor implements HttpInterceptor {

  constructor(private onlineState: OnlineStateService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    // 1. Dacă știm deja că suntem offline → blocăm request-ul
    if (!this.onlineState.isOnline) {
      return throwError(() => new Error('offline'));
    }

    // 2. Lăsăm request-ul să plece, dar interceptăm erorile
    return next.handle(req).pipe(
      catchError(err => {
        // Detectare instant offline
        if (err.status === 0) {
          this.onlineState.setOffline();
        }
        return throwError(() => err);
      })
    );
  }
}
