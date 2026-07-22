import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { normalizePrinterAgentPrinter } from '../../print/printer-agent-printer.util';

export interface PrinterAgentPrinterDto {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  type?: string;
}

export interface PrinterAgentInstallationDto {
  agentId: string;
  enrolledAtUtc: string;
  lastHeartbeatUtc: string | null;
  version: string | null;
  printerIds: string[];
  wireGuardAddressCidr: string | null;
}

export interface FiscalPrinterSettingsDto {
  fiscalPrintingEnabled: boolean;
  defaultFiscalPrinterId: string | null;
  vatGroupMapping: Record<string, number>;
}

export interface FiscalPrintErrorDto {
  jobId: string;
  errorCode: string | null;
  deviceErrorCode: string | null;
  updatedAtUtc: string;
}

export interface FiscalPrintErrorsPageDto {
  items: FiscalPrintErrorDto[];
  total: number;
  skip: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class PrintJobsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Staff-safe endpoint (no inventory exposure): returns the configured default bill printer id.
   */
  getDefaultBillPrinterForStaff(restaurantId: string): Observable<{ defaultBillPrinterId: string | null }> {
    return this.http.get<{ defaultBillPrinterId: string | null }>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/default-bill-printer`,
      { withCredentials: true },
    );
  }

  getDefaultFiscalPrinterForStaff(restaurantId: string): Observable<FiscalPrinterSettingsDto> {
    return this.http.get<FiscalPrinterSettingsDto>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/default-fiscal-printer`,
      { withCredentials: true },
    );
  }

  listAgentPrinters(restaurantId: string): Observable<PrinterAgentPrinterDto[]> {
    const url = `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/printers`;
    return this.http.get<unknown[]>(url, { withCredentials: true }).pipe(
      map(items =>
        (items ?? [])
          .map(item => normalizePrinterAgentPrinter(item))
          .filter((printer): printer is PrinterAgentPrinterDto => printer != null),
      ),
    );
  }

  listAgentInstallations(restaurantId: string): Observable<PrinterAgentInstallationDto[]> {
    const url = `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/installations`;
    return this.http.get<PrinterAgentInstallationDto[]>(url, { withCredentials: true });
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

  getFiscalPrinterSettings(restaurantId: string): Observable<FiscalPrinterSettingsDto> {
    return this.http.get<FiscalPrinterSettingsDto>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/fiscal-printer-settings`,
      { withCredentials: true },
    );
  }

  updateFiscalPrinterSettings(
    restaurantId: string,
    body: Partial<FiscalPrinterSettingsDto>,
  ): Observable<FiscalPrinterSettingsDto> {
    return this.http.patch<FiscalPrinterSettingsDto>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/fiscal-printer-settings`,
      body,
      { withCredentials: true },
    );
  }

  getRecentFiscalPrintErrors(
    restaurantId: string,
    limit = 3,
    skip = 0,
  ): Observable<FiscalPrintErrorsPageDto> {
    return this.http.get<FiscalPrintErrorsPageDto>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/fiscal-print-errors?limit=${limit}&skip=${skip}`,
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

  createFiscalInvoiceJob(
    restaurantId: string,
    printerId: string,
    payload: Record<string, unknown>,
  ): Observable<{ jobId: string } | { JobId: string }> {
    return this.createBillPrintJob(restaurantId, printerId, payload);
  }

  createFiscalStornoResoJob(
    restaurantId: string,
    printerId: string,
    payload: Record<string, unknown>,
  ): Observable<{ jobId: string } | { JobId: string }> {
    return this.createBillPrintJob(restaurantId, printerId, payload);
  }
}
