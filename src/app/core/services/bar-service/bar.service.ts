import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BarService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  callWaiterForPickup(restaurantId: string, tableId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/bar/tables/${tableId}/pickup`,
      {},
      { withCredentials: true }
    );
  }

  snoozePickupCall(restaurantId: string, tableId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/bar/tables/${tableId}/pickup/snooze`,
      {},
      { withCredentials: true }
    );
  }
}
