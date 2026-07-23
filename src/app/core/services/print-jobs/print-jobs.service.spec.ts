import { normalizeFiscalPrinterSettings } from './print-jobs.service';

describe('print-jobs.service normalization', () => {
  it('normalizeFiscalPrinterSettings maps PascalCase API payloads', () => {
    expect(
      normalizeFiscalPrinterSettings({
        FiscalPrintingEnabled: true,
        DefaultFiscalPrinterId: 'printer-1',
        VatGroupMapping: { '22': 1 },
      }),
    ).toEqual({
      fiscalPrintingEnabled: true,
      defaultFiscalPrinterId: 'printer-1',
      vatGroupMapping: { '22': 1 },
    });
  });

  it('normalizeFiscalPrinterSettings returns defaults for invalid payloads', () => {
    expect(normalizeFiscalPrinterSettings(null)).toEqual({
      fiscalPrintingEnabled: false,
      defaultFiscalPrinterId: null,
      vatGroupMapping: {},
    });
  });
});
