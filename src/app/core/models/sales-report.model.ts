/** Matches API camelCase JSON for SalesSummaryReportResponse. */
export interface SalesByCurrencyRow {
  currency: string;
  orderCount: number;
  totalAmount: number;
}

export interface SalesSummaryReportResponse {
  orderCount: number;
  byCurrency: SalesByCurrencyRow[];
}

/** Matches API camelCase JSON for TopProductRow. */
export interface TopProductRow {
  menuItemId: string;
  orderItemName: string;
  currency: string;
  totalQuantity: number;
  totalLineAmount: number;
}
