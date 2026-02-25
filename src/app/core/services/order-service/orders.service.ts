import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { AddOrderItemResponse, CartItem, OrderDTO, UpdateOrderItemQuantityResponse } from '../../models/orderingModel';
import { MenuItem } from '../../models/menu/menuItem';
import { TableDTO } from '../../models/restaurantTablesModel';


@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient) {
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

  /**
   * Map payload -> tableComputed entry (fără efecte secundare).
   * - payload: obiectul SSE OrderUpdated
   * - findTableFn: (tableId) => TableDTO | undefined  (injectezi this.tables.find)
   * - getCssFn: (table: TableDTO | undefined) => string  (injectezi miscService.getTableCss bound)
   * - getLastActionFn: (dateOrString) => string  (injectezi miscService.getLastActionTime bound)
   */
  mapPayloadToComputed(
    payload: any,
    findTableFn: (tableId: string) => TableDTO | undefined,
    getCssFn: (table?: TableDTO) => string,
    getLastActionFn: (d: any) => string
  ): {
    lastActionTime: string;
    lastAddedItem: string;
    total: number;
    currency: string;
    itemCount: number;
    cssClass: string;
  } {
    const tableId = payload.TableId ?? payload.tableId;
    const lastActionAt = payload.lastActionAt ?? payload.LastActionAt;
    const lastAddedItem = payload.lastAddedItem ?? payload.LastAddedItem ?? '—';
    const itemCount = payload.itemCount ?? payload.ItemCount ?? 0;
    const subTotalAmount = payload.SubTotal?.Amount ?? payload.subTotal?.amount ?? 0;
    const subTotalCurrency = payload.SubTotal?.Currency ?? payload.subTotal?.currency ?? '—';

    const table = findTableFn(tableId);
    const cssClass = getCssFn(table);

    return {
      lastActionTime: getLastActionFn(lastActionAt),
      lastAddedItem,
      total: subTotalAmount,
      currency: subTotalCurrency,
      itemCount,
      cssClass
    };
  }
}
