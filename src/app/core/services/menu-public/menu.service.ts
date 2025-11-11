import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})

export class MenuService {

  constructor(private http: HttpClient) { }

  private apiUrl = environment.apiUrl;
  getAll(restaurantId: string, tableId: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(`${this.apiUrl}/public/${restaurantId}/menu/${tableId}`, { withCredentials: true });
  }



}
