import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TableDTO } from '../../models/restaurantTablesModel';
import { NgZone } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OnlineStateService } from '../../offline/online-state-service';
import { OfflineDbService } from '../../offline/offline-db';

@Injectable({
  providedIn: 'root'
})
export class TablesService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private onlineStateService: OnlineStateService,
    private offlineDB: OfflineDbService
  ) {}

  getAll(restaurantId: string): Observable<TableDTO[]> {
    return this.http.get<TableDTO[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/get-tables-status`,
      { withCredentials: true }
    );
  }

  create(restaurantId: string, payload: { numberOfTables: number }): Observable<TableDTO[]> {
    return this.http.post<TableDTO[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables`,
      payload,
      { withCredentials: true }
    );
  }

  update(restaurantId: string, tableId: string, payload: { tableName: string }): Observable<TableDTO> {
    return this.http.put<TableDTO>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables/${tableId}`,
      payload,
      { withCredentials: true }
    );
  }

  delete(restaurantId: string, tableId: string): Observable<TableDTO[]> {
    return this.http.delete<TableDTO[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/tables/${tableId}`,
      { withCredentials: true }
    );
  }

  listenForWaiterCall(restaurantId: string): Observable<any> {
    return new Observable(observer => {
      const eventSource = new EventSource(`${this.apiUrl}/sse/public/restaurant/${restaurantId}`);

      eventSource.addEventListener('WaiterCall', (event: any) => {
        this.ngZone.run(() => observer.next(JSON.parse(event.data)));
      });

      eventSource.onerror = (error) => {
        this.ngZone.run(() => observer.error(error));
      };

      return () => eventSource.close();
    });
  }

  snoozeWaiterCall(restaurantId: string, tableId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/call-waiter`,
      {},
      { withCredentials: true }
    );
  }

  async getAllWithFallback(restaurantId: string): Promise<TableDTO[]> {
    if (this.onlineStateService.isOnline) {
      try {
        const tables = await firstValueFrom(this.getAll(restaurantId));
        await this.offlineDB.saveTables(tables);
        const map = this.buildAvailabilityMap(tables);
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

  /**
   * Singura metodă de construire a hărții de disponibilitate.
   *
   * O masă e disponibilă dacă isTableOpen === true și nu are un order activ.
   * Acceptă TableDTO[] — tipul real returnat de backend la /get-tables-status.
   */
  buildAvailabilityMap(tables: TableDTO[] | null | undefined): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (!Array.isArray(tables)) return map;

    for (const t of tables) {
      if (!t?.tableId) continue;
      map[t.tableId] = !!t.isTableOpen && !t.order;
    }

    return map;
  }
}
