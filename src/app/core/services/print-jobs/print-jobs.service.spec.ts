import { normalizeFiscalPrinterSettings } from './print-jobs.service';

describe('print-jobs.service normalization', () => {
  it('normalizeFiscalPrinterSettings maps PascalCase API payloads', () => {
        expect(
      normalizeFiscalPrinterSettings({
        FiscalCountryCode: 'IT',
        FiscalPrintingEnabled: true,
        DefaultFiscalPrinterId: 'printer-1',
        VatGroupMapping: { '22': 1 },
        FiscalProvider: 'epson-fiscal',
        SupportsInvoice: true,
        SupportsStornoReso: true,
      }),
    ).toEqual({
      fiscalCountryCode: 'IT',
      fiscalPrintingEnabled: true,
      defaultFiscalPrinterId: 'printer-1',
      vatGroupMapping: { '22': 1 },
      fiscalProvider: 'epson-fiscal',
      supportsInvoice: true,
      supportsStornoReso: true,
    });
  });

  it('normalizeFiscalPrinterSettings returns defaults for invalid payloads', () => {
    expect(normalizeFiscalPrinterSettings(null)).toEqual({
      fiscalCountryCode: 'RO',
      fiscalPrintingEnabled: false,
      defaultFiscalPrinterId: null,
      vatGroupMapping: {},
      fiscalProvider: null,
      supportsInvoice: false,
      supportsStornoReso: false,
    });
  });
});
