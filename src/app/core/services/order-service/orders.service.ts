import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { AddOrderItemResponse, CartItem, OrderDTO, OrderUpdatedSSEPayload, TableComputedDTO, UpdateOrderItemQuantityResponse } from '../../models/orderingModel';
import { MenuItem } from '../../models/menu/menuItem';
import { TableDTO } from '../../models/restaurantTablesModel';
import { WaiterCallState } from '../../models/callWaiter/callWaiter';
import { MiscellaneousService } from '../misc/miscellaneous.service';


@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient, private miscService: MiscellaneousService) {
  }

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
  updateOrderItem(restaurantId: string, tableId: string, orderId: string, body: { orderItems: { menuItemId: string; quantity: number }[], seatId: string | null }): Observable<OrderDTO> {
    return this.http.put<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/init-add-order-items`, body, { withCredentials: true });
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

  // orders.service.ts
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

  removeComputed(): void {
    try {
      localStorage.removeItem('tableComputed');
    } catch (e) {
      console.error('Failed to remove tableComputed', e);
    }
  }

  saveWaiterState(waiterState: Record<string, any>): void {
    try {
      localStorage.setItem('waiterState', JSON.stringify(waiterState));
    } catch (e) {
      console.error('Failed to save waiterState', e);
    }
  }

  loadWaiterState(): Record<string, any> {
    try {
      const saved = localStorage.getItem('waiterState');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Failed to load waiterState', e);
      return {};
    }
  }

  // orders.service.ts (adaugă în clasa OrdersService)

  /**
   * Map payload items -> TableCart (fără efecte secundare).
   * - items: payload.Items (array)
   * - menuItems: lista curentă de MenuItem din componentă
   */
  mapPayloadItemsToCart(items: any[] | undefined, menuItems: MenuItem[]): CartItem[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map(o => {
      const menuItemId = o.MenuItemId ?? o.menuItemId;
      const menuItem = menuItems.find(m => m.menuItemId === menuItemId) ?? ({} as MenuItem);

      return {
        item: menuItem,
        quantity: o.Quantity ?? o.quantity ?? 0,
        orderItemId: o.OrderItemId ?? o.orderItemId
      } as CartItem;
    });
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


  mapTableToComputed(
    table: TableDTO,
    waiterState: Record<string, WaiterCallState>,
    computed: TableComputedDTO    
  ) {
    return {
      lastActionAt: computed.lastActionAt,
      lastAddedItem: computed.lastAddedItem ?? '—',
      total: computed.subTotal?.amount ?? 0,
      currency: computed.subTotal?.currency ?? 'EUR',
      itemCount: computed.itemCount ?? 0,
      cssClass: this.miscService.getTableCss(table, waiterState)
    };
  }




}
