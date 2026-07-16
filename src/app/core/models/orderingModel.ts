import { categoryFromOrderLine, lookupMenuItem, menuItemWithNormalizedCategory } from "./menu/cart-item-category";
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

export interface InitAddOrderResponse {
  order: OrderDTO;
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
  /** Staff display name from last order mutation (included in /api/sync). */
  lastInitiatedBy?: string;
  /** Device that last mutated this order (pickup haptic targeting). */
  clientInstanceId?: string;
}

/** Read LastInitiatedBy from API/Dexie (camelCase or PascalCase). */
export function readOrderLastInitiatedBy(order: OrderDTO | null | undefined): string {
  if (!order) return '';
  const rec = order as unknown as Record<string, unknown>;
  const v = rec['lastInitiatedBy'] ?? rec['LastInitiatedBy'];
  return typeof v === 'string' ? v.trim() : '';
}

/** True when table snapshot includes an open order (tolerant of PascalCase / missing flag). */
export function tableHasActiveOrder(order: OrderDTO | null | undefined): boolean {
  if (!order) return false;
  const rec = order as unknown as Record<string, unknown>;
  const orderId = rec['orderId'] ?? rec['OrderId'];
  if (typeof orderId !== 'string' || !orderId.trim()) return false;
  const open = rec['isOrderOpen'] ?? rec['IsOrderOpen'];
  return open !== false && open !== 'false' && open !== 0;
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

/** Build a cart line from persisted order data; optional menu merge enriches icon/availability. */
export function cartItemFromOrderLine(
  orderItem: OrderItemDTO,
  menuItems?: Iterable<MenuItem>
): CartItem {
  const menuMap = menuItems
    ? Object.fromEntries([...menuItems].map(m => [m.menuItemId.toLowerCase(), m]))
    : {};
  const fromMenu = lookupMenuItem(menuMap, orderItem.menuItemId);

  const baseItem: MenuItem = {
    menuItemId: orderItem.menuItemId,
    menuItemName: orderItem.orderItemName,
    menuItemDescription: orderItem.orderItemDescription,
    menuItemPriceAmount: orderItem.orderItemPriceAmount ?? fromMenu?.menuItemPriceAmount ?? 0,
    menuItemPriceCurrency: orderItem.orderItemPriceCurrency ?? fromMenu?.menuItemPriceCurrency,
    menuItemIconUrl: fromMenu?.menuItemIconUrl,
    category: categoryFromOrderLine(orderItem.category, fromMenu),
    isAvailable: fromMenu?.isAvailable,
    menuItemVatPercent: fromMenu?.menuItemVatPercent,
  };

  return {
    item: menuItemWithNormalizedCategory(baseItem),
    quantity: orderItem.quantity,
    orderItemId: orderItem.orderItemId,
  };
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

export interface DeleteOrderItemSSEPayload {
  orderId: string;
  orderItemId: string;
  quantity: number;
  action: string;
}

export interface TableComputedInfo {
  lastActionAt: string;   // ex: "2 minute în urmă"
  lastAddedItem: string;    // ex: "Pizza Margherita"
  total: number;            // subtotal numeric
  currency: string;         // ex: "EUR"
  itemCount: number;        // total items in order
  cssClass: string;         // ex: "bg-success text-white"
}


export interface OrderUpdatedSSEPayload {
  RestaurantId: string;
  TableId: string;
  OrderId: string;

  SubTotal: {
    Amount: number;
    Currency: string;
  } | null;

  ItemCount: number;

  LastAddedItem: string | null;
  LastActionAt: string; // ISO string trimis de backend

  Items: {
    OrderItemId: string;
    MenuItemId: string;
    Quantity: number;
    OrderItemName?: string;
    OrderItemDescription?: string;
    Category?: string;
    OrderItemPriceAmount: number;
    OrderItemPriceCurrency: string;
  }[];
}

export type OrderUpdatedSseLineItem = OrderUpdatedSSEPayload['Items'][number];

function readSseLineString(line: OrderUpdatedSseLineItem, camel: string, pascal: string): string {
  const rec = line as unknown as Record<string, unknown>;
  const v = rec[camel] ?? rec[pascal];
  return typeof v === 'string' ? v : '';
}

function readSseLineNumber(line: OrderUpdatedSseLineItem, camel: string, pascal: string): number {
  const rec = line as unknown as Record<string, unknown>;
  const v = rec[camel] ?? rec[pascal];
  return typeof v === 'number' ? v : 0;
}

/** Map one SSE order line to OrderItemDTO (PascalCase/camelCase tolerant). */
export function orderItemDtoFromSseLine(line: OrderUpdatedSseLineItem): OrderItemDTO {
  const currency = (readSseLineString(line, 'orderItemPriceCurrency', 'OrderItemPriceCurrency') || 'EUR') as Currency;
  return {
    orderItemId: readSseLineString(line, 'orderItemId', 'OrderItemId') || undefined,
    menuItemId: readSseLineString(line, 'menuItemId', 'MenuItemId'),
    orderItemName: readSseLineString(line, 'orderItemName', 'OrderItemName'),
    orderItemDescription: readSseLineString(line, 'orderItemDescription', 'OrderItemDescription'),
    category: readSseLineString(line, 'category', 'Category'),
    orderItemPriceAmount: readSseLineNumber(line, 'orderItemPriceAmount', 'OrderItemPriceAmount'),
    orderItemPriceCurrency: currency,
    quantity: readSseLineNumber(line, 'quantity', 'Quantity'),
  };
}

/** Build cart lines from SSE Items[] using optional menu cache for icons/names. */
export function cartItemsFromSseLines(
  lines: OrderUpdatedSseLineItem[] | null | undefined,
  menuItems?: MenuItem[],
): CartItem[] {
  return (lines ?? []).map(line => cartItemFromOrderLine(orderItemDtoFromSseLine(line), menuItems));
}

/** Minimal OrderDTO for local replica from SSE snapshot. */
export function orderDtoFromSsePayload(
  tableId: string,
  payload: OrderUpdatedSSEPayload,
  initiatedBy?: string,
): OrderDTO {
  const sub = payload.SubTotal as { Amount?: number; Currency?: string; amount?: number; currency?: string } | null;
  const currency = (sub?.Currency ?? sub?.currency ?? payload.Items?.[0]?.OrderItemPriceCurrency ?? 'EUR') as Currency;
  const orderItems = (payload.Items ?? []).map(orderItemDtoFromSseLine);
  return {
    orderId: payload.OrderId,
    tableId,
    createdOn: payload.LastActionAt || new Date().toISOString(),
    isOrderOpen: true,
    currency,
    orderItems,
    subTotal: sub
      ? { amount: sub.Amount ?? sub.amount ?? 0, currency }
      : undefined,
    lastInitiatedBy: initiatedBy?.trim() || undefined,
  };
}

export interface TableComputedDTO {
  tableId: string;
  isTableOpen: boolean;
  orderId?: string;
  lastActionAt?: string;  
  lastAddedItem?: string;    // ex: "Pizza Margherita"
  subTotal?: MoneyDTO;
  itemCount?: number;
}

