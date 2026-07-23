import type { PrinterAgentPrinterDto } from '../services/print-jobs/print-jobs.service';

import { fiscalProfileForCountry } from '../fiscal/fiscal-profile';

export type ResolvedPrinterType = 'escpos' | 'fiscalnet' | 'epson-fiscal';

export function normalizePrinterAgentPrinter(raw: unknown): PrinterAgentPrinterDto | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id = String(record['id'] ?? record['Id'] ?? '').trim();
  if (!id) {
    return null;
  }

  const portRaw = record['port'] ?? record['Port'];
  const port = typeof portRaw === 'number' ? portRaw : Number(portRaw ?? 0);

  return {
    id,
    name: String(record['name'] ?? record['Name'] ?? id),
    ipAddress: String(record['ipAddress'] ?? record['IpAddress'] ?? ''),
    port: Number.isFinite(port) ? port : 0,
    type: resolvePrinterType({
      id,
      name: String(record['name'] ?? record['Name'] ?? id),
      ipAddress: String(record['ipAddress'] ?? record['IpAddress'] ?? ''),
      port: Number.isFinite(port) ? port : 0,
      type: (record['type'] ?? record['Type']) as string | undefined,
    }),
  };
}

/** Mirrors backend PrinterAgentHeartbeatJson.ResolvePrinterType. */
export function resolvePrinterType(printer: PrinterAgentPrinterDto): ResolvedPrinterType {
  const normalized = (printer.type ?? 'escpos').trim().toLowerCase();
  if (normalized === 'fiscalnet') {
    return 'fiscalnet';
  }
  if (normalized === 'epson-fiscal') {
    return 'epson-fiscal';
  }

  if (
    printer.port === 65400
    && (normalized === '' || normalized === 'escpos')
  ) {
    return 'fiscalnet';
  }

  if (
    (printer.port === 443 || printer.port === 9102)
    && (normalized === '' || normalized === 'escpos')
  ) {
    return 'epson-fiscal';
  }

  return normalized === 'escpos' || normalized === '' ? 'escpos' : (normalized as ResolvedPrinterType);
}

export function isFiscalNetPrinter(printer: PrinterAgentPrinterDto): boolean {
  return resolvePrinterType(printer) === 'fiscalnet';
}

export function isEpsonFiscalPrinter(printer: PrinterAgentPrinterDto): boolean {
  return resolvePrinterType(printer) === 'epson-fiscal';
}

export function isAnyFiscalPrinter(printer: PrinterAgentPrinterDto): boolean {
  const type = resolvePrinterType(printer);
  return type === 'fiscalnet' || type === 'epson-fiscal';
}

export function isFiscalPrinterForCountry(
  printer: PrinterAgentPrinterDto,
  countryCode: string | null | undefined,
): boolean {
  const profile = fiscalProfileForCountry(countryCode);
  return resolvePrinterType(printer) === profile.expectedPrinterType;
}

/** @deprecated Use isFiscalPrinterForCountry with restaurant fiscal country. */
export function isFiscalPrinterForLocale(
  printer: PrinterAgentPrinterDto,
  lang: string,
): boolean {
  const countryCode = lang === 'it' ? 'IT' : lang === 'ro' ? 'RO' : '';
  if (!countryCode) {
    return false;
  }
  return isFiscalPrinterForCountry(printer, countryCode);
}
