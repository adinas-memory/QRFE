import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface FiscalDocumentDto {
  id: string;
  orderId: string;
  printJobId: string;
  documentType: string;
  status: string;
  fiscalNumber: string | null;
  zReportNumber: string | null;
  fiscalDate: string | null;
  referencedFiscalDocumentId: string | null;
  provider: string;
  createdAtUtc: string;
  issuedAtUtc: string | null;
}

@Injectable({ providedIn: 'root' })
export class FiscalDocumentsService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listByOrder(
    restaurantId: string,
    orderId: string,
    apiScope: 'staff' | 'admin',
  ): Observable<FiscalDocumentDto[]> {
    return this.http.get<FiscalDocumentDto[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/${apiScope}/orders/${orderId}/fiscal-documents`,
      { withCredentials: true },
    );
  }
}
