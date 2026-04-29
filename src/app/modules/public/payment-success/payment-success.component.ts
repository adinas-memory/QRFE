import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, timer, switchMap, tap, catchError, of, map, take } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { environment } from '../../../../environments/environment';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, SpinnerComponent } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, SpinnerComponent, RouterLink, TranslocoPipe],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.scss'
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  provisioning = true;
  secondsLeft = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly maxPolls = 15;
  private pollCount = 0;
  private readonly apiUrl = environment.apiUrl;
  flow: 'subscription' | 'order' | 'unknown' = 'unknown';
  restaurantId: string | null = null;
  tableId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
  ) {}

  ngOnInit(): void {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H1',location:'payment-success.component.ts:ngOnInit',message:'payment success init',data:{url:typeof window!=='undefined'?window.location.href:null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.route.queryParamMap.pipe(take(1)).subscribe(q => {
      const f = (q.get('flow') ?? '').toLowerCase();
      this.flow = (f === 'subscription' || f === 'order') ? (f as any) : 'unknown';
      this.restaurantId = q.get('restaurantId');
      this.tableId = q.get('tableId');

      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H_flow',location:'payment-success.component.ts:flow',message:'payment-success flow parsed',data:{flow:this.flow,hasRestaurantId:!!this.restaurantId,hasTableId:!!this.tableId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (this.flow === 'order' && this.restaurantId && this.tableId) {
        // Diner/table checkout: do not poll refresh-token and never redirect to login.
        this.provisioning = false;
        this.secondsLeft = 0;
        return;
      }

      // Default: subscription provisioning flow (poll refresh-token until manager role, then redirect to login).
      timer(0, 2000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        this.pollCount++;
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H2',location:'payment-success.component.ts:pollTick',message:'poll tick',data:{pollCount:this.pollCount,maxPolls:this.maxPolls},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return this.authService.refreshUserContext().pipe(
          catchError((err) => {
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H3',location:'payment-success.component.ts:refreshCatch',message:'refreshUserContext errored in payment-success pipeline',data:{pollCount:this.pollCount,status:err?.status??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return of(null);
          }),
          switchMap(user => {
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H1',location:'payment-success.component.ts:afterRefresh',message:'refresh result received',data:{pollCount:this.pollCount,hasUser:!!user,role:user?.role??null,restaurantId:user?.restaurantId??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            if (!user?.restaurantId || user.role !== 'manager') {
              return of(user);
            }
            const pending = this.subscriptionService.getPendingRestaurantCurrency();
            if (!pending) {
              return of(user);
            }
            return this.http.patch(
              `${this.apiUrl}/api/restaurants/${user.restaurantId}/admin/currency`,
              { currency: pending },
              { withCredentials: true },
            ).pipe(
              map(() => {
                this.subscriptionService.clearPendingRestaurantCurrency();
                return user;
              }),
              catchError(err => {
                console.warn('Could not apply operating currency after checkout', err);
                return of(user);
              }),
            );
          }),
        );
      }),
      tap(user => {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H4',location:'payment-success.component.ts:tap',message:'tap branch check',data:{pollCount:this.pollCount,hasUser:!!user,role:user?.role??null,willManagerBranch:!!(user&&user.role==='manager'),willTimeoutBranch:this.pollCount>=this.maxPolls},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (user && user.role === 'manager') {
          this.provisioning = false;
          this.secondsLeft = 3;
          const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
          setTimeout(() => {
            clearInterval(interval);
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H_mgrRedirect',location:'payment-success.component.ts:managerRedirect',message:'redirecting to /login after manager provisioning',data:{pollCount:this.pollCount},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            this.authService.clearUser();
            this.router.navigate(['/login']);
          }, 3000);
          this.destroy$.next();
        } else if (this.pollCount >= this.maxPolls) {
          this.provisioning = false;
          this.secondsLeft = 3;
          const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
          setTimeout(() => {
            clearInterval(interval);
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H_timeoutRedirect',location:'payment-success.component.ts:timeoutRedirect',message:'redirecting to /login after timeout (non-manager)',data:{pollCount:this.pollCount,maxPolls:this.maxPolls,role:user?.role??null,restaurantId:user?.restaurantId??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            this.authService.clearUser();
            this.router.navigate(['/login']);
          }, 3000);
          this.destroy$.next();
        }
      }),
    ).subscribe();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
