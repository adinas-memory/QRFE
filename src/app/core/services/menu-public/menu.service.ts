import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { HttpClient, HttpHeaders } from '@angular/common/http';



@Injectable({
  providedIn: 'root'
})

export class MenuService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private ngZone: NgZone) { }
  
  getAll(restaurantId: string, tableId: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(`${this.apiUrl}/api/public/${restaurantId}/menu/${tableId}`, { withCredentials: true });
  }

  callWaiter(restaurantId: string, tableId: string): Observable<WaiterCallResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Call-Waiter-Cookie': ''
    });
    return this.http.post<WaiterCallResponse>(`${this.apiUrl}/api/public/${restaurantId}/tables/${tableId}/call-waiter`, {}, { withCredentials: true });
  }

  listenWaiterEvents(restaurantId: string): Observable<{ type: 'WaiterCall' | 'WaiterCallSnoozed'; data: any }> {
    return new Observable(observer => {
      const src = new EventSource(`${this.apiUrl}/sse/public/restaurant/${restaurantId}`);

      const onCall = (ev: MessageEvent) => {
        this.ngZone.run(() => observer.next({ type: 'WaiterCall', data: JSON.parse(ev.data) }));
      };
      const onSnoozed = (ev: MessageEvent) => {
        this.ngZone.run(() => observer.next({ type: 'WaiterCallSnoozed', data: JSON.parse(ev.data) }));
      };

      src.addEventListener('WaiterCall', onCall as any);
      src.addEventListener('WaiterCallSnoozed', onSnoozed as any);

      src.onerror = (error) => {
        this.ngZone.run(() => observer.error(error));
      };

      return () => src.close();
    });
  }
}
