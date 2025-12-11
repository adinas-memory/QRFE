import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})

export class MenuService {

  constructor(private http: HttpClient, private ngZone: NgZone) { }

  private apiUrl = environment.apiUrl;
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

  listenForWaiterCall(restaurantId: string): Observable<any> {
    return new Observable(observer => {
      // Replace with your server endpoint that emits SSE
      const eventSource = new EventSource(`/sse/public/restaurant/${restaurantId}`);

      // Listen specifically for the "waiterCall" event
      eventSource.addEventListener('WaiterCall', (event: any) => {
        // Run inside Angular zone so change detection works
        this.ngZone.run(() => {
          observer.next(JSON.parse(event.data));
        });
      });

      // Handle errors
      eventSource.onerror = (error) => {
        this.ngZone.run(() => {
          observer.error(error);
        });
      };

      // Cleanup when unsubscribed
      return () => {
        eventSource.close();
      };
    });
  }

    listenForWaiterCallInternal(restaurantId: string): Observable<any> {
    return new Observable(observer => {
      // Replace with your server endpoint that emits SSE
      const eventSource = new EventSource(`/sse/internal/restaurant/${restaurantId}`);

      // Listen specifically for the "waiterCall" event
      eventSource.addEventListener('WaiterCall', (event: any) => {
        // Run inside Angular zone so change detection works
        this.ngZone.run(() => {
          observer.next(JSON.parse(event.data));
        });
      });

      // Handle errors
      eventSource.onerror = (error) => {
        this.ngZone.run(() => {
          observer.error(error);
        });
      };

      // Cleanup when unsubscribed
      return () => {
        eventSource.close();
      };
    });
  }

}
