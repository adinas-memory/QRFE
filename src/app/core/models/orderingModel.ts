import { MenuItem } from "./menu/menuItem";
import { Currency, SeatDTO } from "./restaurantTablesModel";

export interface OrderItemDTO {
  orderItemId?: string;
  menuItemId: string;
  orderItemName: string;
  orderItemPriceAmount?: number;
  orderItemPriceCurrency: Currency;
  orderItemDescription: string;
  category: string; // MenuItemCategory as string
  quantity: number;
}

export interface OrderDTO {
  restaurantId?: string;
  orderId: string;
  tableId?: string;
  seat?: SeatDTO;
  seatId?: string;
  createdOn: string;   // ISO date string
  closedAt?: string;   // ISO date string
  orderItems?: (OrderItemDTO | null)[];
  currency: Currency;
  isOrderOpen: boolean;
  subTotal?: MoneyDTO;
  finalTotalPrice?: FinalTotalPrice;
  // IsDeleted is ignored in JSON
}

export interface MoneyDTO {
  amount?: number;
  currency: Currency;
}

export interface FinalTotalPrice {
  amount?: number;
  currency: Currency;
  // Id, OrderId, Order are ignored in JSON (so not needed here)
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  orderItemId?: string; 
}

export interface TableCart {
  [tableId: string]: CartItem[];
}

export interface AddOrderItemResponse {
  orderId: string;
  orderItemId: string;
  menuItemId: string;
  quantity: number;
  action: string; 
}

export interface UpdateOrderItemQuantityResponse {
  orderId: string;
  orderItemId: string;    
  quantity: number;
  action: string; 
}

export interface TableComputedInfo {
  lastActionTime: string;   // ex: "2 minute în urmă"
  lastAddedItem: string;    // ex: "Pizza Margherita"
  total: number;            // subtotal numeric
  currency: string;         // ex: "EUR"
  itemCount: number;        // total items in order
  cssClass: string;         // ex: "bg-success text-white"
}

