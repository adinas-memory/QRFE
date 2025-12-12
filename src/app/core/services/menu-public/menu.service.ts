import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { fetchEventSource } from '@microsoft/fetch-event-source';


@Injectable({
  providedIn: 'root'
})

export class MenuService {

  constructor(private http: HttpClient) { }

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
}
