import {
  buildFiscalInvoicePayload,
  buildFiscalStornoResoPayload,
  hasIssuedInvoice,
  listStornoEligibleDocuments,
} from './fiscal-order-print.builder';
import { Currency } from '../models/restaurantTablesModel';

describe('fiscal-order-print.builder', () => {
  const order = {
    orderId: 'order-1',
    createdOn: '2026-07-06T10:00:00Z',
    currency: Currency.EUR,
    isOrderOpen: false,
    subTotal: { amount: 12, currency: Currency.EUR },
    finalTotalPrice: { amount: 12, currency: Currency.EUR },
    orderItems: [
      {
        menuItemId: 'm1',
        orderItemName: 'Pizza',
        orderItemPriceAmount: 12,
        orderItemPriceCurrency: Currency.EUR,
        orderItemDescription: '',
        category: 'food',
        quantity: 1,
      },
    ],
  };

  it('buildFiscalInvoicePayload includes customer and fiscal-invoice type', () => {
    const payload = buildFiscalInvoicePayload({
      order,
      tableName: 'T1',
      restaurantName: 'Trattoria',
      paymentMethod: 'cash',
      customer: {
        customerName: 'Acme SRL',
        customerFiscalCode: 'IT12345678901',
        customerAddressLine1: 'Via Roma 1',
      },
      mapping: { '22': 1 },
    });

    expect(payload['type']).toBe('fiscal-invoice');
    expect(payload['customerName']).toBe('Acme SRL');
    expect(payload['customerFiscalCode']).toBe('IT12345678901');
    expect(Array.isArray(payload['items'])).toBeTrue();
  });

  it('buildFiscalStornoResoPayload includes referenced document id', () => {
    const payload = buildFiscalStornoResoPayload({
      order,
      tableName: 'T1',
      restaurantName: 'Trattoria',
      paymentMethod: 'card',
      referencedFiscalDocumentId: 'doc-1',
      mapping: { '22': 1 },
    });

    expect(payload['type']).toBe('fiscal-storno-reso');
    expect(payload['referencedFiscalDocumentId']).toBe('doc-1');
  });

  it('hasIssuedInvoice detects issued invoice documents', () => {
    expect(hasIssuedInvoice([{ documentType: 'Receipt', status: 'Issued' }])).toBeFalse();
    expect(hasIssuedInvoice([{ documentType: 'Invoice', status: 'Issued' }])).toBeTrue();
  });

  it('listStornoEligibleDocuments excludes documents with existing storno', () => {
    const docs = listStornoEligibleDocuments([
      {
        id: 'a',
        orderId: 'order-1',
        printJobId: 'job-1',
        documentType: 'Receipt',
        status: 'Issued',
        fiscalNumber: '1',
        zReportNumber: '1',
        fiscalDate: null,
        referencedFiscalDocumentId: null,
        provider: 'Epson',
        createdAtUtc: '2026-07-06T10:00:00Z',
        issuedAtUtc: '2026-07-06T10:00:00Z',
      },
      {
        id: 'b',
        orderId: 'order-1',
        printJobId: 'job-2',
        documentType: 'StornoReso',
        status: 'Issued',
        fiscalNumber: '2',
        zReportNumber: '1',
        fiscalDate: null,
        referencedFiscalDocumentId: 'a',
        provider: 'Epson',
        createdAtUtc: '2026-07-06T10:00:00Z',
        issuedAtUtc: '2026-07-06T10:00:00Z',
      },
    ]);

    expect(docs.map(d => d.id)).toEqual([]);
  });
});
