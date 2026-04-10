import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { firstValueFrom, Observable } from 'rxjs';
import { AddOrderItemResponse, CartItem, InitAddOrderResponse, OrderDTO, OrderUpdatedSSEPayload, TableComputedDTO, UpdateOrderItemQuantityResponse } from '../../models/orderingModel';
import { MenuItem } from '../../models/menu/menuItem';
import { TableDTO } from '../../models/restaurantTablesModel';
import { WaiterCallState } from '../../models/callWaiter/callWaiter';
import { MiscellaneousService } from '../misc/miscellaneous.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';



@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient,
    private miscService: MiscellaneousService,
    private offlineDB: OfflineDbService,
    private onlineStateService: OnlineStateService) {
  }




  // ------------------------------
  // HTTP METHODS (OBSERVABLES)
  // ------------------------------

  newOrder(restaurantId: string, tableId: string, seatId?: string): Observable<{ order: OrderDTO }> {
    return this.http.post<{ order: OrderDTO }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/new-order`,
      {},
      { withCredentials: true }
    );
  }

  listOpenOrderForTable(restaurantId: string, tableId: string): Observable<OrderDTO> {
    return this.http.get<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/list-open-order`, { withCredentials: true });
  }

  //confirm order
  updateOrderItem(restaurantId: string, tableId: string, orderId: string, body: { orderItems: { menuItemId: string; quantity: number }[], seatId: string | null }): Observable<InitAddOrderResponse> {
    return this.http.put<InitAddOrderResponse>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/init-add-order-items`, body, { withCredentials: true });
  }

  deleteOrderItem(restaurantId: string, tableId: string, orderId: string, orderItemId: string): Observable<OrderDTO> {
    return this.http.delete<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/${orderItemId}/delete-order-item`, { withCredentials: true });
  }

  closeOrder(restaurantId: string, tableId: string, orderId: string): Observable<OrderDTO> {
    return this.http.post<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/close-order`, {}, { withCredentials: true });
  }

  listTablesStatus(restaurantId: string): Observable<OrderDTO[]> {
    return this.http.get<OrderDTO[]>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/get-tables-status`, { withCredentials: true });
  }

  listOrdersTimeFrame(restaurantId: string, tableId: string, from: string, to: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/filter-by-date`, { withCredentials: true });
  }

  // new methods
  addOrderItem(restaurantId: string, tableId: string, currentOrderId: string, menuItemId: string, quantity: number): Observable<AddOrderItemResponse> {
    console.log('Adding order item:', { restaurantId, tableId, currentOrderId, menuItemId, quantity });
    return this.http.post<AddOrderItemResponse>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${currentOrderId}/add-order-item`, { menuItemId, quantity }, { withCredentials: true });
  }

  updateOrderItemQuantity(restaurantId: string, tableId: string, currentOrderId: string, orderItemId: string, quantity: number): Observable<UpdateOrderItemQuantityResponse> {
    console.log('Updating order item quantity:', { restaurantId, tableId, currentOrderId, orderItemId, quantity });
    return this.http.put<UpdateOrderItemQuantityResponse>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${currentOrderId}/items/${orderItemId}/update-order-item-qty`, { quantity }, { withCredentials: true });
  }

  closeOrderAfterPayment(restaurantId: string, tableId: string, orderId: string): Observable<OrderDTO> {
    return this.http.post<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/close`, {}, { withCredentials: true });
  }

  saveComputed(tableComputed: Record<string, any>): void {
    try {
      localStorage.setItem('tableComputed', JSON.stringify(tableComputed));
    } catch (e) {
      console.error('Failed to save tableComputed', e);
    }
  }

  loadComputed(): Record<string, any> {
    try {
      const saved = localStorage.getItem('tableComputed');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load tableComputed', e);
      return {};
    }
  }

  mapPayloadToComputed(
    payload: OrderUpdatedSSEPayload,
    tables: TableDTO[],
    waiterState: Record<string, WaiterCallState>
  ) {
    const table = tables.find(t => t.tableId === payload.TableId);
    console.log('Mapping payload:', payload, 'Found table:', table);
    return {
      lastActionAt: payload.LastActionAt,
      lastAddedItem: payload.LastAddedItem ?? '—',
      total: payload.SubTotal?.Amount ?? 0,
      currency: payload.SubTotal?.Currency ?? 'EUR',
      itemCount: payload.ItemCount ?? 0,
      cssClass: this.miscService.getTableCss(table!, waiterState)
    };
  }

  async listOpenOrderForTableWithFallback(
    restaurantId: string,
    tableId: string
  ): Promise<OrderDTO | null> {

    const localOrder = await this.offlineDB.loadOrder(tableId);

    if (!this.onlineStateService.isOnline) {
      return localOrder;
    }

    try {
      const remoteOrder = await firstValueFrom(
        this.listOpenOrderForTable(restaurantId, tableId)
      );

      if (!remoteOrder || !remoteOrder.orderId) {
        return localOrder;
      }

      await this.offlineDB.saveOrderSnapshot(tableId, remoteOrder);
      return remoteOrder;

    } catch (err: any) {
      console.warn('Failed to fetch order from server, falling back to local. Error:', err);
      return localOrder;
    }
  }
 
  moveOrder(restaurantId: string, sourceTableId: string, targetTableId: string) {
    return this.http.post<{ orderId?: string, sourceTable?: TableDTO, targetTable?: TableDTO }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${sourceTableId}/move-cart`,
      { targetTableId },
      { withCredentials: true }
    );
  }


}
