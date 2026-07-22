import { buildFiscalPrintItems, type FiscalPrintItemInput } from './fiscal-print-payload.builder';
import type { OrderDTO } from '../models/orderingModel';
import type { FiscalVatGroupMapping } from './fiscal-vat-group.mapper';

import type { FiscalDocumentDto } from '../services/fiscal-documents/fiscal-documents.service';

export interface FiscalInvoiceCustomerInput {
  customerName: string;
  customerFiscalCode: string;
  customerAddressLine1: string;
  customerAddressLine2?: string;
}

export function buildFiscalPrintItemsFromOrder(
  order: OrderDTO,
  mapping: FiscalVatGroupMapping | null | undefined,
): ReturnType<typeof buildFiscalPrintItems> {
  const items: FiscalPrintItemInput[] = (order.orderItems ?? [])
    .filter((item): item is NonNullable<typeof item> => item != null)
    .map(item => ({
      name: item.orderItemName,
      quantity: item.quantity,
      unitPrice: item.orderItemPriceAmount ?? 0,
    }));

  return buildFiscalPrintItems(items, mapping);
}

export function buildFiscalInvoicePayload(args: {
  order: OrderDTO;
  tableName: string;
  restaurantName: string;
  paymentMethod: 'cash' | 'card';
  customer: FiscalInvoiceCustomerInput;
  mapping: FiscalVatGroupMapping | null | undefined;
}): Record<string, unknown> {
  const items = buildFiscalPrintItemsFromOrder(args.order, args.mapping);
  const finalTotal = args.order.finalTotalPrice?.amount ?? args.order.subTotal?.amount ?? 0;

  return {
    type: 'fiscal-invoice',
    orderId: args.order.orderId,
    restaurantName: args.restaurantName,
    tableName: args.tableName,
    currency: args.order.finalTotalPrice?.currency ?? args.order.subTotal?.currency ?? args.order.currency,
    subTotal: args.order.subTotal?.amount ?? finalTotal,
    finalTotal,
    paymentMethod: args.paymentMethod,
    closedAtUtc: args.order.closedAt ?? new Date().toISOString(),
    customerName: args.customer.customerName.trim(),
    customerFiscalCode: args.customer.customerFiscalCode.trim(),
    customerAddressLine1: args.customer.customerAddressLine1.trim(),
    customerAddressLine2: args.customer.customerAddressLine2?.trim() || null,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatGroup: item.vatGroup,
    })),
  };
}

export function buildFiscalStornoResoPayload(args: {
  order: OrderDTO;
  tableName: string;
  restaurantName: string;
  paymentMethod: 'cash' | 'card';
  referencedFiscalDocumentId: string;
  mapping: FiscalVatGroupMapping | null | undefined;
}): Record<string, unknown> {
  const items = buildFiscalPrintItemsFromOrder(args.order, args.mapping);
  const finalTotal = args.order.finalTotalPrice?.amount ?? args.order.subTotal?.amount ?? 0;

  return {
    type: 'fiscal-storno-reso',
    orderId: args.order.orderId,
    restaurantName: args.restaurantName,
    tableName: args.tableName,
    currency: args.order.finalTotalPrice?.currency ?? args.order.subTotal?.currency ?? args.order.currency,
    subTotal: args.order.subTotal?.amount ?? finalTotal,
    finalTotal,
    paymentMethod: args.paymentMethod,
    closedAtUtc: args.order.closedAt ?? new Date().toISOString(),
    referencedFiscalDocumentId: args.referencedFiscalDocumentId,
    items: items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatGroup: item.vatGroup,
    })),
  };
}

export function hasIssuedInvoice(documents: Array<{ documentType: string; status: string }>): boolean {
  return documents.some(
    doc => doc.documentType === 'Invoice' && doc.status === 'Issued',
  );
}

export function listStornoEligibleDocuments(documents: FiscalDocumentDto[]): FiscalDocumentDto[] {
  return documents.filter(
    doc =>
      doc.status === 'Issued'
      && (doc.documentType === 'Receipt' || doc.documentType === 'Invoice')
      && !documents.some(
        storno =>
          storno.documentType === 'StornoReso'
          && storno.status === 'Issued'
          && storno.referencedFiscalDocumentId === doc.id,
      ),
  );
}
