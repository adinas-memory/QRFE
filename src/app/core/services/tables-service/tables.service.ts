import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TableDTO } from '../../models/restaurantTablesModel';

@Injectable({
  providedIn: 'root'
})
export class TablesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll(restaurantId: string): Observable<TableDTO[]> {
    return this.http.get<TableDTO[]>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/status`, { withCredentials: true });
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

  snoozeWaiterCall(restaurantId: string, tableId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/call-waiter`, {}, { withCredentials: true });
  }
}
