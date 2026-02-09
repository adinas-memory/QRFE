import { MenuItem } from "./menu/menuItem";

export interface OrderItemDTO {
  orderItemId: string;
  menuItemId: string;
  qty: number;
}

export interface CartItem {
  item: MenuItem;
  qty: number;
}

export interface TableCart {
    [tableId: string]: CartItem[];
}