import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface PrinterAgentPrinterDto {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

export interface PrinterAgentInstallationDto {
  agentId: string;
  enrolledAtUtc: string;
  lastHeartbeatUtc: string | null;
  version: string | null;
  printerIds: string[];
  wireGuardAddressCidr: string | null;
}

@Injectable({ providedIn: 'root' })
export class PrintJobsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // #region agent log
  private dbg(hypothesisId: string, message: string, data: Record<string, unknown>): void {
    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '38fcde' },
      body: JSON.stringify({
        sessionId: '38fcde',
        runId: 'pre-fix',
        hypothesisId,
        location: 'print-jobs.service.ts',
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  /**
   * Staff-safe endpoint (no inventory exposure): returns the configured default bill printer id.
   */
  getDefaultBillPrinterForStaff(restaurantId: string): Observable<{ defaultBillPrinterId: string | null }> {
    return this.http.get<{ defaultBillPrinterId: string | null }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/default-bill-printer`,
      { withCredentials: true },
    );
  }

  listAgentPrinters(restaurantId: string): Observable<PrinterAgentPrinterDto[]> {
    const url = `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/printers`;
    // #region agent log
    this.dbg('C', 'listAgentPrinters request', { restaurantId, url });
    // #endregion
    return this.http.get<PrinterAgentPrinterDto[]>(url, { withCredentials: true }).pipe(
      tap(rows => {
        // #region agent log
        this.dbg('C', 'listAgentPrinters success', {
          restaurantId,
          count: rows?.length ?? 0,
          printerIds: (rows ?? []).map(p => p.id),
        });
        // #endregion
      }),
      catchError(err => {
        // #region agent log
        this.dbg('B_D', 'listAgentPrinters error', {
          restaurantId,
          status: (err as { status?: number })?.status ?? null,
          statusText: (err as { statusText?: string })?.statusText ?? null,
        });
        // #endregion
        return throwError(() => err);
      }),
    );
  }

  listAgentInstallations(restaurantId: string): Observable<PrinterAgentInstallationDto[]> {
    const url = `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/installations`;
    // #region agent log
    this.dbg('E', 'listAgentInstallations request', { restaurantId, url });
    // #endregion
    return this.http.get<PrinterAgentInstallationDto[]>(url, { withCredentials: true }).pipe(
      tap(rows => {
        // #region agent log
        this.dbg('E', 'listAgentInstallations success', {
          restaurantId,
          count: rows?.length ?? 0,
          agentIds: (rows ?? []).map(r => r.agentId),
          printerIds: (rows ?? []).flatMap(r => r.printerIds ?? []),
        });
        // #endregion
      }),
      catchError(err => {
        // #region agent log
        this.dbg('B_E', 'listAgentInstallations error', {
          restaurantId,
          status: (err as { status?: number })?.status ?? null,
          statusText: (err as { statusText?: string })?.statusText ?? null,
        });
        // #endregion
        return throwError(() => err);
      }),
    );
  }

  removeAgentInstallation(restaurantId: string, agentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/installations/${encodeURIComponent(agentId)}`,
      { withCredentials: true },
    );
  }

  updateDefaultBillPrinter(restaurantId: string, defaultBillPrinterId: string | null): Observable<{ defaultBillPrinterId: string | null }> {
    return this.http.patch<{ defaultBillPrinterId: string | null }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/default-bill-printer`,
      { defaultBillPrinterId },
      { withCredentials: true },
    );
  }

  getDefaultBillPrinter(restaurantId: string): Observable<{ defaultBillPrinterId: string | null }> {
    return this.http.get<{ defaultBillPrinterId: string | null }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/default-bill-printer`,
      { withCredentials: true },
    );
  }

  createBillPrintJob(restaurantId: string, printerId: string, payload: unknown): Observable<{ jobId: string } | { JobId: string }> {
    return this.http.post<{ jobId: string } | { JobId: string }>(
      `${this.apiUrl}/api/print-jobs`,
      { restaurantId, printerId, payload },
      { withCredentials: true },
    );
  }
}

