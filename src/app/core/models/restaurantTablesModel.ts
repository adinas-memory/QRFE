// ---------- ENUMS ----------

import { OrderDTO } from "./orderingModel";


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


export interface SeatDTO {
  restaurantId: string;
  seatId: string;
  isSeatOpen: boolean;
  seatName?: string;
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




