import { normalizeFiscalDocumentDto, normalizeFiscalDocuments } from './fiscal-documents.service';

describe('fiscal-documents.service normalization', () => {
  it('normalizeFiscalDocumentDto maps PascalCase API payloads', () => {
    const doc = normalizeFiscalDocumentDto({
      Id: 'doc-1',
      OrderId: 'order-1',
      PrintJobId: 'job-1',
      DocumentType: 'Receipt',
      Status: 'Issued',
      FiscalNumber: '42',
      ZReportNumber: '7',
      FiscalDate: null,
      ReferencedFiscalDocumentId: null,
      Provider: 'FiscalNet',
      CreatedAtUtc: '2026-07-06T10:00:00Z',
      IssuedAtUtc: '2026-07-06T10:01:00Z',
    });

    expect(doc).toEqual({
      id: 'doc-1',
      orderId: 'order-1',
      printJobId: 'job-1',
      documentType: 'Receipt',
      status: 'Issued',
      fiscalNumber: '42',
      zReportNumber: '7',
      fiscalDate: null,
      referencedFiscalDocumentId: null,
      provider: 'FiscalNet',
      createdAtUtc: '2026-07-06T10:00:00Z',
      issuedAtUtc: '2026-07-06T10:01:00Z',
    });
  });

  it('normalizeFiscalDocuments ignores invalid rows', () => {
    expect(normalizeFiscalDocuments([{ Id: 'x' }, null])).toEqual([]);
  });
});
