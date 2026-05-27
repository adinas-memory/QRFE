import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardMetricsResponse } from '../../models/dashboard-metrics.model';
import { LoginLogoutReportResponse } from '../../models/login-logout-report.model';
import { SalesSummaryReportResponse, TopProductRow } from '../../models/sales-report.model';

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * GET /api/restaurants/{restaurantId}/admin/reports/login-logout
   * Dates are ISO date-only (yyyy-MM-dd), interpreted as UTC calendar days on the server.
   */
  getLoginLogoutReport(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Observable<LoginLogoutReportResponse> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<LoginLogoutReportResponse>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/reports/login-logout`,
      { withCredentials: true, params }
    );
  }

  getSalesSummary(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Observable<SalesSummaryReportResponse> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http.get<SalesSummaryReportResponse>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/reports/sales-summary`,
      { withCredentials: true, params }
    );
  }

  /**
   * GET /api/restaurants/{restaurantId}/staff/dashboard/metrics
   * KPIs: rolling 30 UTC days vs prior 30 days; series for charts.
   */
  getDashboardMetrics(restaurantId: string): Observable<DashboardMetricsResponse> {
    return this.http.get<DashboardMetricsResponse>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/dashboard/metrics`,
      { withCredentials: true }
    );
  }

  getTopProducts(
    restaurantId: string,
    startDate: string,
    endDate: string,
    top: number
  ): Observable<TopProductRow[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate)
      .set('top', String(top));
    return this.http.get<TopProductRow[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/reports/top-products`,
      { withCredentials: true, params }
    );
  }

  /** Downloads CSV; filename comes from Content-Disposition when present. */
  downloadAccountingOrdersCsv(restaurantId: string, startDate: string, endDate: string): Observable<void> {
    return this.downloadCsv(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/reports/exports/accounting-orders.csv`,
      startDate,
      endDate,
      `accounting-orders-${startDate}-${endDate}.csv`
    );
  }

  downloadAccountingOrderLinesCsv(
    restaurantId: string,
    startDate: string,
    endDate: string
  ): Observable<void> {
    return this.downloadCsv(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/reports/exports/accounting-order-lines.csv`,
      startDate,
      endDate,
      `accounting-order-lines-${startDate}-${endDate}.csv`
    );
  }

  private downloadCsv(
    url: string,
    startDate: string,
    endDate: string,
    fallbackName: string
  ): Observable<void> {
    const params = new HttpParams().set('startDate', startDate).set('endDate', endDate);
    return this.http
      .get(url, {
        params,
        responseType: 'blob',
        observe: 'response',
        withCredentials: true
      })
      .pipe(
        map(res => {
          const blob = res.body;
          if (!blob) {
            throw new Error('Empty response');
          }
          const fromHeader = parseFilenameFromContentDisposition(res.headers.get('Content-Disposition'));
          triggerBlobDownload(blob, fromHeader ?? fallbackName);
        })
      );
  }
}

function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const encoded = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(header);
  if (encoded) {
    const raw = encoded[1].trim().replace(/^"+|"+$/g, '');
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted) {
    return quoted[1];
  }
  const plain = /filename=([^;\n]+)/i.exec(header);
  return plain ? plain[1].trim().replace(/^"+|"+$/g, '') : null;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}
