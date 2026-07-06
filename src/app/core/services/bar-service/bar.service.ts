import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EMPTY, Observable, finalize } from 'rxjs';
import { endStaffPickupCall, tryBeginStaffPickupCall } from '../staff-pickup-call.guard';

@Injectable({
  providedIn: 'root'
})
export class BarService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  callWaiterForPickup(restaurantId: string, tableId: string): Observable<void> {
    if (!tryBeginStaffPickupCall('bar', restaurantId, tableId)) {
      return EMPTY;
    }
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/bar/tables/${tableId}/pickup`,
      {},
      { withCredentials: true },
    ).pipe(finalize(() => endStaffPickupCall('bar', restaurantId, tableId)));
  }

  snoozePickupCall(restaurantId: string, tableId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/bar/tables/${tableId}/pickup/snooze`,
      {},
      { withCredentials: true }
    );
  }
}
