import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, shareReplay, map, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ProductLimitModel, SubscriptionProductModel } from '../../models/subscription-product';
import { PendingPlanModel } from '../../models/pendingPlanModel';
import { SubscriptionPayloadModel } from '../../models/subscriptionPayloadModel';
import { CreateSubscriptionProductModel } from '../../models/subscription-product';
import { environment } from '../../../../environments/environment';
import {
  CancelSubscriptionResultModel,
  ManagerSubscriptionStatusModel,
} from '../../models/manager-subscription-status.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private apiUrl = environment.apiUrl;
  private pendingPlan: PendingPlanModel | null = null;
  private products$ = new BehaviorSubject<SubscriptionProductModel[]>([]);

  constructor(private http: HttpClient) { }

  getProductsLimits(): Observable<ProductLimitModel[]> {
    return this.http.get<ProductLimitModel[]>(`${this.apiUrl}/api/user/restaurant-limits`);
  }

  loadProducts(): void {
    this.http.get<SubscriptionProductModel[]>(`${this.apiUrl}/api/stripe/subscription`)
      .subscribe({
        next: products => this.products$.next(products),
        error: err => console.error('Failed to load subscription products', err)
      });
  }

  /** Expose products as observable */
  getProducts(): Observable<SubscriptionProductModel[]> {
    return this.http.get<SubscriptionProductModel[]>(`${this.apiUrl}/api/stripe/subscription`)
      .pipe(shareReplay(1));
  }

  createProduct(payload: any): Observable<CreateSubscriptionProductModel> {
    return this.http.post<CreateSubscriptionProductModel>(`${this.apiUrl}/api/restaurants/create-subscription-product`, payload, { withCredentials: true });
  }

  updateProduct(payload: any): Observable<{ productId: string; priceId: string }> {
    return this.http.put<{ productId: string; priceId: string }>(
      `${this.apiUrl}/api/restaurants/update-subscription-product`,
      payload,
      { withCredentials: true }
    );
  }

  /** Store a pending plan (when user not logged in yet) */
  setPendingPlan(plan: PendingPlanModel): void {
    this.pendingPlan = plan;
    sessionStorage.setItem('pendingPlan', JSON.stringify(plan));
  }

  /** Retrieve pending plan after login */
  getPendingPlan(): PendingPlanModel | null {
    if (!this.pendingPlan) {
      const stored = sessionStorage.getItem('pendingPlan');
      if (stored) {
        this.pendingPlan = JSON.parse(stored);
      }
    }
    return this.pendingPlan;
  }

  /** Clear pending plan */
  clearPendingPlan(): void {
    this.pendingPlan = null;
    sessionStorage.removeItem('pendingPlan');
  }

  private static readonly pendingRestaurantCurrencyKey = 'pendingRestaurantCurrency';

  setPendingRestaurantCurrency(isoCode: string): void {
    sessionStorage.setItem(SubscriptionService.pendingRestaurantCurrencyKey, isoCode);
  }

  getPendingRestaurantCurrency(): string | null {
    return sessionStorage.getItem(SubscriptionService.pendingRestaurantCurrencyKey);
  }

  clearPendingRestaurantCurrency(): void {
    sessionStorage.removeItem(SubscriptionService.pendingRestaurantCurrencyKey);
  }

  subscribeToPlan(payload: SubscriptionPayloadModel): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/stripe/subscription`,
      payload, { withCredentials: true });
  }

  /** Provision restaurant when Stripe webhook did not reach the API (dev LAN / missed webhook). */
  completeSubscriptionCheckout(sessionId: string): Observable<{
    isProvisioned: boolean;
    role?: string;
    restaurantId?: string;
    message?: string;
  }> {
    return this.http.post<{
      isProvisioned: boolean;
      role?: string;
      restaurantId?: string;
      message?: string;
    }>(
      `${this.apiUrl}/api/stripe/subscription/complete`,
      {},
      { params: { session_id: sessionId }, withCredentials: true },
    );
  }

  /** Current manager subscription / cancellation state from MyCustomers. */
  getManagerSubscriptionStatus(): Observable<ManagerSubscriptionStatusModel> {
    return this.http
      .get<Record<string, unknown>>(`${this.apiUrl}/api/stripe/subscription/status`, {
        withCredentials: true,
      })
      .pipe(map(raw => this.normalizeManagerSubscriptionStatus(raw)));
  }

  /** Cancel Stripe subscription for the logged-in manager (server loads IDs from DB). */
  cancelSubscription(): Observable<CancelSubscriptionResultModel> {
    return this.http
      .request('DELETE', `${this.apiUrl}/api/stripe/subscription`, {
        body: {},
        withCredentials: true,
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        switchMap((response: HttpResponse<string>) => {
          if (response.status < 200 || response.status >= 300) {
            return throwError(() => response);
          }
          return this.mapCancelSubscriptionResponse(response.body ?? '');
        }),
      );
  }

  private mapCancelSubscriptionResponse(body: string): Observable<CancelSubscriptionResultModel> {
    const trimmed = body.trim();
    if (!trimmed) {
      return this.cancelResultFromStatusOrFallback();
    }
    try {
      const raw = JSON.parse(trimmed) as Record<string, unknown>;
      return of(this.normalizeCancelSubscriptionResult(raw));
    } catch {
      // Legacy API: Ok("Subscription cancelled.") — plain text, not JSON.
      if (!/cancel/i.test(trimmed)) {
        return throwError(() => new Error(trimmed));
      }
      return this.cancelResultFromStatusOrFallback();
    }
  }

  private cancelResultFromStatusOrFallback(): Observable<CancelSubscriptionResultModel> {
    return this.getManagerSubscriptionStatus().pipe(
      map(status => ({
        isCancelled: true,
        cancelAtPeriodEnd: status.cancelAtPeriodEnd || true,
        cancelAtUtc: status.cancelAtUtc,
        subscriptionStatus: status.subscriptionStatus,
      })),
      catchError(() =>
        of({
          isCancelled: true,
          cancelAtPeriodEnd: true,
          cancelAtUtc: null,
          subscriptionStatus: 'active',
        }),
      ),
    );
  }

  private normalizeManagerSubscriptionStatus(
    raw: Record<string, unknown>,
  ): ManagerSubscriptionStatusModel {
    const cancelAtUtcRaw = raw['cancelAtUtc'] ?? raw['CancelAtUtc'];
    return {
      subscriptionStatus: (raw['subscriptionStatus'] ?? raw['SubscriptionStatus'] ?? null) as string | null,
      cancelAtPeriodEnd: Boolean(raw['cancelAtPeriodEnd'] ?? raw['CancelAtPeriodEnd']),
      cancelAtUtc: cancelAtUtcRaw != null && cancelAtUtcRaw !== '' ? String(cancelAtUtcRaw) : null,
    };
  }

  private normalizeCancelSubscriptionResult(
    raw: Record<string, unknown>,
  ): CancelSubscriptionResultModel {
    const status = this.normalizeManagerSubscriptionStatus(raw);
    return {
      isCancelled: Boolean(raw['isCancelled'] ?? raw['IsCancelled'] ?? true),
      cancelAtPeriodEnd: status.cancelAtPeriodEnd,
      cancelAtUtc: status.cancelAtUtc,
      subscriptionStatus: status.subscriptionStatus,
    };
  }
}
