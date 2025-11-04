// ---------- ENUMS ----------
export enum MenuItemCategory {
  Appetizer = 'Appetizer',
  Starter = 'Starter',
  FirstCourse = 'FirstCourse',
  SecondCourse = 'SecondCourse',
  Pizza = 'Pizza',
  Dessert = 'Dessert',
  RedWine = 'RedWine',
  WhiteWine = 'WhiteWine',
  RoseWine = 'RoseWine',
  Beer = 'Beer',
  Beverage = 'Beverage'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  RON = 'RON',
  GBP = 'GBP',
  SEK = 'SEK',
  NOK = 'NOK',
  DKK = 'DKK',
  JPY = 'JPY',
  CHF = 'CHF',
  AUD = 'AUD',
  CAD = 'CAD',
  CNY = 'CNY',
  INR = 'INR',
  BRL = 'BRL'
}

// ---------- DTOs ----------
export interface MoneyDTO {
  amount?: number;
  currency: Currency;
}

export interface FinalTotalPrice {
  amount?: number;
  currency: Currency;
  // Id, OrderId, Order are ignored in JSON (so not needed here)
}

export interface SeatDTO {
  restaurantId: string;
  seatId: string;
  isSeatOpen: boolean;
  seatName?: string;
}

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

export interface BaseTableDTO {
  restaurantId: string;
  tableId: string;
  isTableOpen: boolean;
  tableName?: string;
}

export interface TableDTO extends BaseTableDTO {
  order?: OrderDTO;
  isWaiterCalled: boolean;
}
