import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { OrderDTO } from '../../models/orderingModel';
import { HttpClient, HttpParams } from '@angular/common/http';

/** Events delivered on `/sse/public/restaurant/{restaurantId}` (see backend `SseAudience.Public`). */
export type PublicRestaurantSseEvent =
  | { type: 'WaiterCall'; data: unknown }
  | { type: 'WaiterCallSnoozed'; data: unknown }
  | { type: 'NewOrderPublic'; data: unknown };



@Injectable({
  providedIn: 'root'
})

export class MenuService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private ngZone: NgZone) { }
  
  getAll(
    restaurantId: string,
    tableId: string,
    opts?: { clientDate?: string; viewAs?: string }
  ): Observable<MenuResponse> {
    let params = new HttpParams();
    const clientDate = opts?.clientDate ?? new Date().toLocaleDateString('en-CA');
    params = params.set('clientDate', clientDate);
    if (opts?.viewAs) {
      params = params.set('viewAs', opts.viewAs);
    }
    return this.http.get<MenuResponse>(
      `${this.apiUrl}/api/public/${restaurantId}/menu/${tableId}`,
      { params, withCredentials: true }
    );
  }

  callWaiter(restaurantId: string, tableId: string): Observable<WaiterCallResponse> {
    const url = `${this.apiUrl}/api/public/${restaurantId}/tables/${tableId}/call-waiter`;    
    return this.http.post<WaiterCallResponse>(url, {}, { withCredentials: true });
  }

  getTableOrder(restaurantId: string, tableId: string): Observable<OrderDTO | null> {
    return this.http.get<OrderDTO | null>(
      `${this.apiUrl}/api/public/${restaurantId}/tables/${tableId}/orders`,
      { withCredentials: true },
    );
  }

  /**
   * Server-sent events for anonymous guests (waiter call + new empty order broadcast).
   * Teardown closes the `EventSource` (call when leaving the page or pausing while the tab is hidden).
   */
  listenPublicRestaurantSse(restaurantId: string): Observable<PublicRestaurantSseEvent> {
    return new Observable(observer => {
      const src = new EventSource(`${this.apiUrl}/sse/public/restaurant/${restaurantId}`);

      const onCall = (ev: MessageEvent) => {
        this.ngZone.run(() => observer.next({ type: 'WaiterCall', data: JSON.parse(ev.data) }));
      };
      const onSnoozed = (ev: MessageEvent) => {
        this.ngZone.run(() => observer.next({ type: 'WaiterCallSnoozed', data: JSON.parse(ev.data) }));
      };
      const onNewOrderPublic = (ev: MessageEvent) => {
        this.ngZone.run(() => observer.next({ type: 'NewOrderPublic', data: JSON.parse(ev.data) }));
      };

      src.addEventListener('WaiterCall', onCall as EventListener);
      src.addEventListener('WaiterCallSnoozed', onSnoozed as EventListener);
      src.addEventListener('NewOrderPublicEvent', onNewOrderPublic as EventListener);

      src.onerror = (error) => {
        this.ngZone.run(() => observer.error(error));
      };

      return () => src.close();
    });
  }
}
