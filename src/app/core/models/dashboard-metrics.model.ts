/** Matches GET .../staff/dashboard/metrics (camelCase JSON). */
export interface DashboardDayPoint {
  date: string;
  closedOrders: number;
  revenue: number;
  loginEvents: number;
}

export interface DashboardMonthPoint {
  year: number;
  month: number;
  closedOrders: number;
  revenue: number;
}

export interface DashboardKpis {
  staffAccountsTotal: number;
  activeUsers: number;
  activeUsersDeltaPercent: number;
  income: number;
  incomeCurrency: string;
  incomeDeltaPercent: number;
  conversionRatePercent: number;
  conversionRateDeltaPercent: number;
  sessionCount: number;
  sessionDeltaPercent: number;
}

export interface DashboardMetricsResponse {
  kpis: DashboardKpis;
  dailySeries: DashboardDayPoint[];
  monthlySeries: DashboardMonthPoint[];
}
