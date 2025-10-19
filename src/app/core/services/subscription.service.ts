import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SubscriptionProduct } from '../models/subscription-product';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  constructor(private http: HttpClient) {}

  getSubscriptionProducts(): Observable<SubscriptionProduct[]> {
    return this.http.get<SubscriptionProduct[]>('http://127.0.0.1:7051/api/stripe/subscription', {
      withCredentials: true
    });
  }
}


