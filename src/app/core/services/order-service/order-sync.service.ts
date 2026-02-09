import { Injectable } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MenuItem } from '../../models/menu/menuItem';
import { CartItem } from '../../models/orderingModel';
import { OrderItemDTO } from '../../models/restaurantTablesModel';
import { OrdersService } from './orders.service';

@Injectable({
  providedIn: 'root'
})
export class OrderSyncService {


  constructor(private ordersService: OrdersService) {
  }

  syncCartWithOrder(orderItems: OrderItemDTO[], menuItems: MenuItem[]): CartItem[] {
    return orderItems.map(orderItem => {
      const menuItem = menuItems.find(m => m.menuItemId === orderItem.menuItemId);
      if (!menuItem) return null;
      return {
        item: menuItem,
        qty: orderItem.quantity
      };
    }).filter(x => x !== null) as CartItem[];
  }

  calculateOrderDiff(
    cart: CartItem[],
    orderItems: (OrderItemDTO | null)[]
  ) {
    const adds: { menuItemId: string; quantity: number }[] = [];
    const updates: { orderItemId: string; quantity: number }[] = [];
    const deletes: string[] = [];

    const orderMap = new Map(
      orderItems
        .filter((o): o is OrderItemDTO => o !== null)
        .map(o => [o.menuItemId, o])
    );

    // ADD or UPDATE
    for (const cartItem of cart) {
      const existing = orderMap.get(cartItem.item.menuItemId);

      if (!existing) {
        adds.push({
          menuItemId: cartItem.item.menuItemId,
          quantity: cartItem.qty
        });
      } else if (existing.quantity !== cartItem.qty) {
        updates.push({
          orderItemId: existing.orderItemId!,
          quantity: cartItem.qty
        });
      }
    }

    // DELETE
    for (const orderItem of orderMap.values()) {
      const stillExists = cart.some(c => c.item.menuItemId === orderItem.menuItemId);
      if (!stillExists) {
        deletes.push(orderItem.orderItemId!);
      }
    }

    return { adds, updates, deletes };
  }


  syncOrderWithBackend(
    restaurantId: string,
    tableId: string,
    orderId: string,
    diff: {
      adds: { menuItemId: string; qty: number }[],
      updates: { orderItemId: string; quantity: number }[],
      deletes: string[]
    }
  ) {
    const calls = [];

    // ADD
    for (const add of diff.adds) {
      calls.push(
        this.ordersService.addOrderItem(restaurantId, tableId, orderId, add)
      );
    }

    // UPDATE
    for (const upd of diff.updates) {
      calls.push(
        this.ordersService.addOrderItem(restaurantId, tableId, orderId, {
          menuItemId: upd.orderItemId, // WRONG → trebuie menuItemId
          qty: upd.quantity
        })
      );
    }

    // DELETE
    for (const del of diff.deletes) {
      calls.push(
        this.ordersService.removeOrderItem(restaurantId, tableId, orderId, del)
      );
    }

    return forkJoin(calls);
  }

}
