import {
  isEpsonFiscalPrinter,
  isFiscalNetPrinter,
  normalizePrinterAgentPrinter,
  resolvePrinterType,
} from './printer-agent-printer.util';

describe('printer-agent-printer util', () => {
  it('normalizes PascalCase API payloads', () => {
    const printer = normalizePrinterAgentPrinter({
      Id: 'it-epson',
      Name: 'Epson FP',
      IpAddress: '192.168.1.20',
      Port: 443,
      Type: 'epson-fiscal',
    });

    expect(printer).toEqual({
      id: 'it-epson',
      name: 'Epson FP',
      ipAddress: '192.168.1.20',
      port: 443,
      type: 'epson-fiscal',
    });
  });

  it('infers epson-fiscal from port when type is escpos', () => {
    const printer = normalizePrinterAgentPrinter({
      id: 'it-epson',
      name: 'Epson FP',
      ipAddress: '192.168.1.20',
      port: 443,
      type: 'escpos',
    });

    expect(printer?.type).toBe('epson-fiscal');
    expect(isEpsonFiscalPrinter(printer!)).toBeTrue();
  });

  it('keeps explicit epson-fiscal type even on non-default port', () => {
    const printer = {
      id: 'it-epson',
      name: 'Epson FP',
      ipAddress: '192.168.1.20',
      port: 8443,
      type: 'epson-fiscal',
    };

    expect(resolvePrinterType(printer)).toBe('epson-fiscal');
    expect(isEpsonFiscalPrinter(printer)).toBeTrue();
  });

  it('infers fiscalnet from port 65400', () => {
    const printer = {
      id: 'ro-fiscal',
      name: 'FiscalNet',
      ipAddress: '127.0.0.1',
      port: 65400,
      type: 'escpos',
    };

    expect(isFiscalNetPrinter(printer)).toBeTrue();
  });
});
