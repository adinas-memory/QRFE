import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TableDTO } from '../../models/restaurantTablesModel';
import { NgZone } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class TablesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private ngZone: NgZone) { }

  getAll(restaurantId: string): Observable<TableDTO[]> {
    return this.http.get<TableDTO[]>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/get-tables-status`, { withCredentials: true });
  }

  create(restaurantId: string, payload: { numberOfTables: number }): Observable<TableDTO[]> {
    return this.http.post<TableDTO[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables`,
      payload,
      { withCredentials: true }
    );
  }

  update(restaurantId: string, tableId: string, payload: { tableName: string }): Observable<TableDTO> {
    return this.http.put<TableDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables/${tableId}`, payload, { withCredentials: true });
  }

  delete(restaurantId: string, tableId: string): Observable<TableDTO[]> {
    return this.http.delete<TableDTO[]>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables/${tableId}`, { withCredentials: true });
  }

  listenForWaiterCall(restaurantId: string): Observable<any> {
    return new Observable(observer => {
      // Replace with your server endpoint that emits SSE
      const eventSource = new EventSource(`${this.apiUrl}/sse/public/restaurant/${restaurantId}`);

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

  snoozeWaiterCall(restaurantId: string, tableId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/call-waiter`, {}, { withCredentials: true });
  }

}
