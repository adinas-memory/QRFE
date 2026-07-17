import {
  defaultItalianVatMapping,
  defaultRomanianVatMapping,
  resolveFiscalVatGroup,
} from './fiscal-vat-group.mapper';
import { buildFiscalPrintItems } from './fiscal-print-payload.builder';

describe('fiscal vat mapping', () => {
  it('resolves Romanian default mapping', () => {
    expect(resolveFiscalVatGroup(21, defaultRomanianVatMapping())).toBe(1);
    expect(resolveFiscalVatGroup(11, defaultRomanianVatMapping())).toBe(2);
    expect(resolveFiscalVatGroup(5, defaultRomanianVatMapping())).toBe(3);
  });

  it('resolves Italian default mapping', () => {
    expect(resolveFiscalVatGroup(22, defaultItalianVatMapping())).toBe(1);
    expect(resolveFiscalVatGroup(10, defaultItalianVatMapping())).toBe(2);
    expect(resolveFiscalVatGroup(5, defaultItalianVatMapping())).toBe(3);
    expect(resolveFiscalVatGroup(4, defaultItalianVatMapping())).toBe(4);
  });

  it('builds fiscal print items with vatGroup', () => {
    const items = buildFiscalPrintItems(
      [{ name: 'Pizza', quantity: 1, unitPrice: 30, menuItemVatPercent: 11 }],
      defaultRomanianVatMapping(),
    );
    expect(items[0].vatGroup).toBe(2);
  });
});
