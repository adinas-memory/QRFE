import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';

import { Observable } from 'rxjs';
import { CartItem, OrderDTO } from '../../models/orderingModel';


@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient) {
  }

  newOrder(restaurantId: string, tableId: string, seatId?: string): Observable<{ order: OrderDTO }> {
    return this.http.post<{ order: OrderDTO }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/orders`,
      {},
      { withCredentials: true }
    );
  }



  listOpenOrderForTable(restaurantId: string, tableId: string): Observable<OrderDTO> {
    return this.http.get<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/orders`, { withCredentials: true });
  }

  updateOrderItem(restaurantId: string, tableId: string, orderId: string, body: { orderItems: { menuItemId: string; quantity: number }[], seatId: string | null }): Observable<OrderDTO> {
    return this.http.put<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}`, body, { withCredentials: true });
  }

  removeOrderItem(restaurantId: string, tableId: string, orderId: string, orderItemId: string): Observable<OrderDTO> {
    return this.http.delete<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/${orderItemId}`, { withCredentials: true });
  }

  closeOrder(restaurantId: string, tableId: string, orderId: string): Observable<OrderDTO> {
    return this.http.post<OrderDTO>(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/close`, {}, { withCredentials: true });
  }

  listTablesStatus(restaurantId: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/status`, { withCredentials: true });
  }

  listOrdersTimeFrame(restaurantId: string, tableId: string, from: string, to: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/filter-by-date}`, { withCredentials: true });
  }
}
