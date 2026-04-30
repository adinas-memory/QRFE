import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MenuItemEntity, OfflineDbService } from '../../offline/offline-db';


@Injectable({
  providedIn: 'root'
})
export class MenuItemServiceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private offlineDB: OfflineDbService) { }

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

  setAvailability(restaurantId: string, menuItemId: string, isAvailable: boolean): Observable<{ menuId: string; menuItem: MenuItem }> {
    return this.http.patch<{ menuId: string; menuItem: MenuItem }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/menu/${menuItemId}/availability`,
      { isAvailable },
      { withCredentials: true }
    );
  }

  // async getAllWithFallback(restaurantId: string): Promise<{ menuItems: MenuItem[], categories: string[] }> {
  //   if (navigator.onLine) {
  //     try {
  //       const response = await firstValueFrom(this.getAll(restaurantId));

  //       // Backend returns an array of menus → extract all menuItems
  //       const allItems: MenuItem[] = response.flatMap(m => m.menu.menuItems);

  //       // Save to Dexie
  //       await this.offlineDB.transaction('rw', this.offlineDB.menuItems, async () => {
  //         await this.offlineDB.menuItems.clear();
  //         await this.offlineDB.menuItems.bulkAdd(allItems);
  //       });

  //       const categories = [...new Set(allItems.map(i => i.category))];

  //       return { menuItems: allItems, categories };

  //     } catch (err) {
  //       console.warn('[MenuService] Online fetch failed, using Dexie fallback');
  //       return this.loadFromDexie();
  //     }
  //   }

  //   // Offline → Dexie fallback
  //   return this.loadFromDexie();
  // }

async getAllWithFallback(
  restaurantId: string
): Promise<{ menuItems: MenuItem[], categories: string[] }> {

  try {
    const response = await firstValueFrom(this.getAll(restaurantId));

    // backend-ul trimite UN SINGUR obiect, nu array
    const menuItems = response.menu.menuItems;

    await this.offlineDB.cacheMenu(menuItems);

  } catch (err) {
    console.warn('[MenuItemService] Backend unavailable, using Dexie fallback');
  }

  return await this.offlineDB.loadMenu();
}




  // private async loadFromDexie(): Promise<{ menuItems: MenuItem[], categories: string[] }> {
  //   const menuItems = await this.offlineDB.menuItems.toArray() as MenuItemEntity[];

  //   const categories: string[] = [...new Set(menuItems.map((i: MenuItemEntity) => i.category))];

  //   return { menuItems, categories };
  // }

}
