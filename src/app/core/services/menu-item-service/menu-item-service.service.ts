import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MenuItemServiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll(restaurantId: string): Observable<MenuResponse> {
    return this.http.get<MenuResponse>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/menu`, { withCredentials: true });
  }

  create(restaurantId: string, formData: FormData): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu`, formData, { withCredentials: true });
  }

  update(restaurantId: string, menuItemId: string, formData: FormData): Observable<MenuItem> {
    return this.http.put<MenuItem>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu/${menuItemId}`, formData, { withCredentials: true });
  }

  delete(restaurantId: string, menuItemId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu/${menuItemId}`, { withCredentials: true });
  }

  async getAllWithFallback(restaurantId: string): Promise<{ menuItems: MenuItem[], categories: string[] }> {
    if (navigator.onLine) {
      try {
        const response = await firstValueFrom(this.getAll(restaurantId));

        const menuItems = response.menu?.menuItems ?? [];
        const categories = response.categories ?? [];

        localStorage.setItem('menuSnapshot', JSON.stringify({ menuItems, categories }));

        return { menuItems, categories };

      } catch (err) {
        console.warn('[MenuService] Online fetch failed, using local snapshot');
        return this.loadLocalMenu();
      }
    }

    return this.loadLocalMenu();
  }

  private loadLocalMenu(): { menuItems: MenuItem[], categories: string[] } {
    try {
      const saved = localStorage.getItem('menuSnapshot');
      return saved ? JSON.parse(saved) : { menuItems: [], categories: [] };
    } catch {
      return { menuItems: [], categories: [] };
    }
  }
}
