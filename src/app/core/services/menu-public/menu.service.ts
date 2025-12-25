import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuResponse, WaiterCallResponse } from '../../models/menu/menuItem';
import { HttpClient, HttpHeaders } from '@angular/common/http';



@Injectable({
  providedIn: 'root'
})

export class MenuService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }
  
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
