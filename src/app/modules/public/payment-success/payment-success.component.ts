import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, timer, switchMap, tap, catchError, of, map, take, Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAssignedRestaurantId } from '../../../core/auth/restaurant-id.util';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { UserContextModel } from '../../../core/models/userContextModel';
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
      this.flow = (f === 'subscription' || f === 'order') ? (f as 'subscription' | 'order') : 'unknown';
      this.restaurantId = q.get('restaurantId');
      this.tableId = q.get('tableId');

      if (this.flow === 'order' && this.restaurantId && this.tableId) {
        this.provisioning = false;
        this.secondsLeft = 0;
        return;
      }

      const sessionId = q.get('session_id');
      this.runSubscriptionProvisioning(sessionId);
    });
  }

  private runSubscriptionProvisioning(sessionId: string | null): void {
    const complete$: Observable<unknown> = sessionId
      ? this.subscriptionService.completeSubscriptionCheckout(sessionId).pipe(
          catchError(err => {
            console.warn('Subscription complete fallback failed', err);
            return of(null);
          }),
        )
      : of(null);

    complete$.pipe(
      switchMap(() => timer(0, 2000).pipe(
        takeUntil(this.destroy$),
        switchMap(() => {
          this.pollCount++;
          return this.refreshAndMaybePatchCurrency();
        }),
        tap(user => {
          if (this.isManagerProvisioned(user)) {
            this.finishManagerSuccess(user!);
            this.destroy$.next();
          } else if (this.pollCount >= this.maxPolls) {
            this.finishProvisioningTimeout();
            this.destroy$.next();
          }
        }),
      )),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  private refreshAndMaybePatchCurrency(): Observable<UserContextModel | null> {
    return this.authService.refreshUserContext({ redirectOnFailure: false }).pipe(
      catchError(() => of(null)),
      switchMap(user => {
        if (!this.isManagerProvisioned(user)) {
          return of(user);
        }
        const pending = this.subscriptionService.getPendingRestaurantCurrency();
        if (!pending || !user?.restaurantId) {
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
  }

  private isManagerProvisioned(user: UserContextModel | null): boolean {
    return !!user
      && user.role === 'manager'
      && isAssignedRestaurantId(user.restaurantId);
  }

  private finishManagerSuccess(user: UserContextModel): void {
    this.authService.setUser(user);
    this.authService.setRestaurantCtx();
    this.provisioning = false;
    this.secondsLeft = 3;
    const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
    setTimeout(() => {
      clearInterval(interval);
      void this.router.navigate(['/manager']);
    }, 3000);
  }

  private finishProvisioningTimeout(): void {
    this.provisioning = false;
    this.secondsLeft = 3;
    const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
    setTimeout(() => {
      clearInterval(interval);
      void this.router.navigate(['/login']);
    }, 3000);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
