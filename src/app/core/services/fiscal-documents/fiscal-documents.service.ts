import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
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

export function normalizeFiscalDocumentDto(raw: unknown): FiscalDocumentDto | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = String(record['id'] ?? record['Id'] ?? '').trim();
  const orderId = String(record['orderId'] ?? record['OrderId'] ?? '').trim();
  if (!id || !orderId) {
    return null;
  }

  const nullableString = (value: unknown): string | null => {
    if (value == null) {
      return null;
    }
    const text = String(value).trim();
    return text || null;
  };

  return {
    id,
    orderId,
    printJobId: String(record['printJobId'] ?? record['PrintJobId'] ?? '').trim(),
    documentType: String(record['documentType'] ?? record['DocumentType'] ?? '').trim(),
    status: String(record['status'] ?? record['Status'] ?? '').trim(),
    fiscalNumber: nullableString(record['fiscalNumber'] ?? record['FiscalNumber']),
    zReportNumber: nullableString(record['zReportNumber'] ?? record['ZReportNumber']),
    fiscalDate: nullableString(record['fiscalDate'] ?? record['FiscalDate']),
    referencedFiscalDocumentId: nullableString(
      record['referencedFiscalDocumentId'] ?? record['ReferencedFiscalDocumentId'],
    ),
    provider: String(record['provider'] ?? record['Provider'] ?? '').trim(),
    createdAtUtc: String(record['createdAtUtc'] ?? record['CreatedAtUtc'] ?? '').trim(),
    issuedAtUtc: nullableString(record['issuedAtUtc'] ?? record['IssuedAtUtc']),
  };
}

export function normalizeFiscalDocuments(raw: unknown): FiscalDocumentDto[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map(item => normalizeFiscalDocumentDto(item))
    .filter((doc): doc is FiscalDocumentDto => doc != null);
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
    return this.http.get<unknown>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/${apiScope}/orders/${orderId}/fiscal-documents`,
      { withCredentials: true },
    ).pipe(map(normalizeFiscalDocuments));
  }
}
