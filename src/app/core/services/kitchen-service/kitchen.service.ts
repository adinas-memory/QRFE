import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EMPTY, Observable, finalize } from 'rxjs';
import { endStaffPickupCall, tryBeginStaffPickupCall } from '../staff-pickup-call.guard';

@Injectable({
  providedIn: 'root'
})
export class KitchenService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Backend endpoint (to implement in .NET):
   * POST /api/restaurants/{restaurantId}/staff/kitchen/tables/{tableId}/pickup
   *
   * Should emit an INTERNAL SSE event (suggested type: "KitchenWaiterCall")
   * so all devices in the restaurant can react (ex: manage-orders highlights the table).
   */
  callWaiterForPickup(restaurantId: string, tableId: string): Observable<void> {
    if (!tryBeginStaffPickupCall(restaurantId, tableId)) {
      return EMPTY;
    }
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/kitchen/tables/${tableId}/pickup`,
      {},
      { withCredentials: true },
    ).pipe(finalize(() => endStaffPickupCall(restaurantId, tableId)));
  }

  /**
   * POST /api/restaurants/{restaurantId}/staff/kitchen/tables/{tableId}/pickup/snooze
   * Emits INTERNAL SSE event: "KitchenWaiterCallSnoozed"
   */
  snoozePickupCall(restaurantId: string, tableId: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/kitchen/tables/${tableId}/pickup/snooze`,
      {},
      { withCredentials: true }
    );
  }
}

