import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { VenueSizeConfigList } from '../../models/venueSizeConfigModel';
import { WaiterCallState } from '../../models/callWaiter/callWaiter';
import { TableDTO } from '../../models/restaurantTablesModel';

@Injectable({
  providedIn: 'root'
})
export class MiscellaneousService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCurrencies(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/api/restaurants/currencies`);
  }

  getRestaurantLimits(): Observable<VenueSizeConfigList> {
    return this.http.get<VenueSizeConfigList>(`${this.apiUrl}/api/user/restaurant-limits`);
  }

  getLastActionTime(lastActionAt: string | null): string {
    if (!lastActionAt) return '—';
    // console.log('Calculating last action time for:', lastActionAt);
    const ts = new Date(lastActionAt).getTime();
    const diff = Math.floor((Date.now() - ts) / 60000); // minute

    if (diff <= 0) return 'now';
    if (diff === 1) return '1 minute ago';
    return `${diff} minutes ago`;
  }


  getTableCss(table: TableDTO, waiterState: Record<string, WaiterCallState>): string {
    if (waiterState[table.tableId] === WaiterCallState.Active) { return 'bg-warning text-dark'; }
    if (waiterState[table.tableId] === WaiterCallState.Snoozed) { return 'bg-secondary text-white'; }
    if (table.isTableOpen) { return 'bg-success text-white'; }
    return 'bg-danger text-white';
  }

}
