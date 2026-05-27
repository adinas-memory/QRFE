import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PrinterAgentPrinterDto {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
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

  listAgentPrinters(restaurantId: string): Observable<PrinterAgentPrinterDto[]> {
    return this.http.get<PrinterAgentPrinterDto[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/printer-agent/printers`,
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

