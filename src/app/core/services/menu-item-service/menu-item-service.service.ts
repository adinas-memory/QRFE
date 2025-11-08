import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class MenuItemServiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll(restaurantId: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/menu`, {withCredentials: true});
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/api/menu-item-categories`);
  }

  create(restaurantId: string, formData: FormData): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu`, formData, {withCredentials: true});
  }

  update(restaurantId: string, menuItemId: string, formData: FormData): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu/${menuItemId}`, formData, {withCredentials: true});
  }

  delete(restaurantId: string, menuItemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu/${menuItemId}`, {withCredentials: true});
  }
}
