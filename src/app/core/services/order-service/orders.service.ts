import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient) {
  }

  newOrder(restaurantId: string, tableId: string) {
    return this.http.post(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/orders`, {}, { withCredentials: true });
  }

  listOpenOrderForTable(restaurantId: string, tableId: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/${tableId}/orders`, { withCredentials: true });
  }

  addOrderItem(restaurantId: string, tableId: string, orderId: string, payload: { menuItemId: string; qty: number }) { return this.http.put(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}`, payload, { withCredentials: true }); }

  removeOrderItem(restaurantId: string, tableId: string, orderId: string, orderItemId: string) { return this.http.delete(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/${orderItemId}`, { withCredentials: true }); }

  closeOrder(restaurantId: string, tableId: string, orderId: string) { return this.http.post(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/${orderId}/close`, {}, { withCredentials: true }); }

  listTablesStatus(restaurantId: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/tables/status`, { withCredentials: true });
  }

  listOrdersTimeFrame(restaurantId: string, tableId: string, from: string, to: string) {
    return this.http.get(`${this.apiUrl}/api/restaurants/${restaurantId}/staff/${tableId}/orders/filter-by-date}`, { withCredentials: true });
  }
}
