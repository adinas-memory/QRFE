import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable, map, tap } from 'rxjs';
import { MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { OrderDTO } from '../../models/orderingModel';
import { HttpClient } from '@angular/common/http';

export type PublicRestaurantSseEvent =
  | { type: 'WaiterCall'; data: unknown }
  | { type: 'WaiterCallSnoozed'; data: unknown }
  | { type: 'NewOrderPublic'; data: unknown };

@Injectable({ providedIn: 'root' })
export class MenuService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private ngZone: NgZone) {}

  getAll(restaurantId: string, tableId: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(
      `${this.apiUrl}/api/public/${restaurantId}/menu/${tableId}`,
      { withCredentials: true }
    );
  }

  callWaiter(restaurantId: string, tableId: string): Observable<WaiterCallResponse> {
    const url = `${this.apiUrl}/api/public/${restaurantId}/tables/${tableId}/call-waiter`;
    const startedAt = performance.now();
    return this.http
      .post<WaiterCallResponse>(url, {}, { withCredentials: true, observe: 'response' })
      .pipe(
        tap((res) => {
          // #region agent log
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Debug-Session-Id': '7379f5',
            },
            body: JSON.stringify({
              sessionId: '7379f5',
              runId: 'post-fix',
              hypothesisId: 'E',
              location: 'menu.service.ts:callWaiter',
              message: 'call-waiter client timing',
              data: {
                durationMs: Math.round(performance.now() - startedAt),
                serverTiming: res.headers.get('X-Debug-Timing'),
                status: res.status,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }),
        map((res) => res.body as WaiterCallResponse),
      );
  }

  getTableOrder(restaurantId: string, tableId: string): Observable<OrderDTO | null> {
    return this.http.get<OrderDTO | null>(
      `${this.apiUrl}/api/public/${restaurantId}/tables/${tableId}/orders`,
      { withCredentials: true },
    );
  }

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
