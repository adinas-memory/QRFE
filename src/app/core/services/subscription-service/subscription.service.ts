import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { SubscriptionProductModel } from '../../models/subscription-product';
import { PendingPlanModel } from '../../models/pendingPlanModel';
import { SubscriptionPayloadModel } from '../../models/subscriptionPayloadModel';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}


  private pendingPlan: PendingPlanModel | null = null;

  // cache products in memory
  private products$ = new BehaviorSubject<SubscriptionProductModel[]>([]);

  loadProducts(): void {
    this.http.get<SubscriptionProductModel[]>(`${this.apiUrl}/api/stripe/subscription`)
      .subscribe({
        next: products => this.products$.next(products),
        error: err => console.error('Failed to load subscription products', err)
      });
  }

  /** Expose products as observable */
  getProducts(): Observable<SubscriptionProductModel[]> {
    return this.products$.asObservable();
  }

    /** Store a pending plan (when user not logged in yet) */
  setPendingPlan(plan: PendingPlanModel): void {
    this.pendingPlan = plan;
    sessionStorage.setItem('pendingPlan', JSON.stringify(plan)); // optional persistence
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

    subscribeToPlan(payload: SubscriptionPayloadModel): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/stripe/subscription`,
       payload, {withCredentials: true });
  }
















}


