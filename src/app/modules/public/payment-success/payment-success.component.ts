import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, timer, switchMap, tap, catchError, of, map } from 'rxjs';
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

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
  ) {}

  ngOnInit(): void {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H7',location:'payment-success.component.ts:ngOnInit:entry',message:'PaymentSuccessComponent init',data:{url:typeof window!=='undefined'?window.location.href:null,hasSessionIdParam:typeof window!=='undefined'?new URLSearchParams(window.location.search).has('session_id'):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    timer(0, 2000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        this.pollCount++;
        return this.authService.refreshUserContext().pipe(
          catchError(() => of(null)),
          switchMap(user => {
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H7',location:'payment-success.component.ts:ngOnInit:poll',message:'Polled refreshUserContext',data:{pollCount:this.pollCount,hasUser:!!user,role:user?.role??null,hasRestaurantId:!!user?.restaurantId},timestamp:Date.now()})}).catch(()=>{});
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
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H7',location:'payment-success.component.ts:ngOnInit:tap',message:'Tap executed',data:{pollCount:this.pollCount,role:user?.role??null,willRedirectToLogin:!!(user&&user.role==='manager')||this.pollCount>=this.maxPolls},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (user && user.role === 'manager') {
          this.provisioning = false;
          this.secondsLeft = 3;
          const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
          setTimeout(() => {
            clearInterval(interval);
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
            this.authService.clearUser();
            this.router.navigate(['/login']);
          }, 3000);
          this.destroy$.next();
        }
      }),
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
