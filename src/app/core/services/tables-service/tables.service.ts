import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable, take } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TableDTO } from '../../models/restaurantTablesModel';
import { NgZone } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MiscellaneousService } from '../misc/miscellaneous.service';
import { OnlineStateService } from '../../offline/online-state-service';
import { OrderDTO } from '../../models/orderingModel';
import { OfflineDbService } from '../../offline/offline-db';



@Injectable({
  providedIn: 'root'
})
export class TablesService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient,
    private ngZone: NgZone,
    private onlineStateService: OnlineStateService,
    private offlineDB: OfflineDbService) { }

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

  async getAllWithFallback(restaurantId: string): Promise<TableDTO[]> {
    if (this.onlineStateService.isOnline) {
      try {
        const tables = await firstValueFrom(this.getAll(restaurantId));
        await this.offlineDB.saveTables(tables);
        const map = this.buildAvailabilityMapFromTables(tables);
        await this.offlineDB.saveTablesStatus(map);
        return tables;

      } catch (err) {
        console.warn('[TablesService] Online fetch failed, using local snapshot');
        this.onlineStateService.setOffline();
        return this.offlineDB.loadLocalTables();
      }
    }

    return this.offlineDB.loadLocalTables();
  }

  private loadLocalTables(): TableDTO[] {
    try {
      const saved = localStorage.getItem('tablesSnapshot');
      const parsed = saved ? JSON.parse(saved) : [];

      // garantăm că întoarcem un array valid
      if (!Array.isArray(parsed)) return [];

      return parsed;
    } catch {
      return [];
    }
  }
  // utils/build-availability-from-orders.ts


  buildAvailabilityMapFromOrders(list: OrderDTO[] | null | undefined): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (!Array.isArray(list)) return map;

    for (const entry of list) {
      // extragem tableId din entry sau din order (fallback)
      const tableId = entry.tableId ?? '';
      if (!tableId) continue;

      // backend poate folosi isOrderOpen sau isTableOpen; preferăm isTableOpen când există
      const isTableOpen = (entry as any).isTableOpen ?? entry.isOrderOpen ?? false;

      // dacă există obiect order, considerăm că masa are order deschis doar dacă order.isOrderOpen === true
      const orderObj = entry;
      const hasOpenOrder = !!orderObj && !!orderObj.isOrderOpen === true;

      // disponibil dacă masa e deschisă și nu are order deschis
      const available = !!isTableOpen && !hasOpenOrder;

      map[tableId] = available;
    }

    return map;
  }

  buildAvailabilityMapFromTables(tables: TableDTO[] | null | undefined): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (!Array.isArray(tables)) return map;
    for (const t of tables) {
      if (!t?.tableId) continue;
      // regula: disponibil dacă isTableOpen === true și nu există order
      map[t.tableId] = !!t.isTableOpen && !t.order;
    }
    return map;
  }



}
