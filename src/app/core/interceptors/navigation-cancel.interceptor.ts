import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, takeUntil, tap, throwError } from 'rxjs';
import { HttpNavigationCancelService } from '../services/http-navigation-cancel.service';

export const navigationCancelInterceptor: HttpInterceptorFn = (req, next) => {
  const nav = inject(HttpNavigationCancelService);
  const isMetrics = req.url.includes('/staff/dashboard/metrics');
  return next(req).pipe(
    takeUntil(nav.cancelForRequest()),
    tap({
      complete: () => {
        if (isMetrics) {
          // #region agent log
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-CANCEL',location:'navigation-cancel.interceptor.ts:complete',message:'metrics request completed (interceptor view)',data:{url:req.url.split('?')[0]},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
      },
    }),
    catchError(err => {
      if (isMetrics) {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-dashboard',hypothesisId:'H-CANCEL',location:'navigation-cancel.interceptor.ts:error',message:'metrics errored at navigation-cancel level',data:{url:req.url.split('?')[0],status:err?.status??null,name:err?.name??null,message:String(err?.message||'').slice(0,200)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      return throwError(() => err);
    }),
  );
};
