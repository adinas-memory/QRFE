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

  get successBodyKey(): string {
    return this.flow === 'order' ? 'payment.success.orderBody' : 'payment.success.body';
  }

  get successCtaKey(): string {
    return this.flow === 'order' ? 'payment.success.orderCta' : 'payment.success.cta';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private subscriptionService: SubscriptionService,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(take(1)).subscribe(q => {
      const f = (q.get('flow') ?? '').toLowerCase();
      this.flow = (f === 'subscription' || f === 'order') ? (f as any) : 'unknown';
      this.restaurantId = q.get('restaurantId');
      this.tableId = q.get('tableId');

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
        return this.authService.refreshUserContext().pipe(
          catchError((err) => {
            return of(null);
          }),
          switchMap(user => {
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
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
