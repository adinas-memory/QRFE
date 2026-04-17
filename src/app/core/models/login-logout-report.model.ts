/** Matches backend `LoginLogoutReportItem` (camelCase JSON). */
export interface LoginLogoutReportItem {
  eventId: string;
  userId: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  eventType: string;
  createdAtUtc: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginLogoutReportResponse {
  items: LoginLogoutReportItem[];
}
