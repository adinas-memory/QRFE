import { fiscalProfileForCountry, normalizeFiscalCountryCode } from './fiscal-profile';

export type FiscalVatGroupMapping = Record<string, number>;

const DEFAULT_RO_MAPPING: FiscalVatGroupMapping = {
  '21': 1,
  '11': 2,
  '5': 3,
};

const DEFAULT_IT_MAPPING: FiscalVatGroupMapping = {
  '22': 1,
  '10': 2,
  '5': 3,
  '4': 4,
};

export function normalizeVatPercentKey(vatPercent: number): string {
  const rounded = Math.round(vatPercent * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
}

export function resolveFiscalVatGroup(
  vatPercent: number | null | undefined,
  mapping: FiscalVatGroupMapping | null | undefined,
): number | undefined {
  if (vatPercent == null || !Number.isFinite(vatPercent))
    return undefined;

  const key = normalizeVatPercentKey(vatPercent);
  const group = mapping?.[key];
  return group != null && group >= 1 && group <= 5 ? group : undefined;
}

export function defaultRomanianVatMapping(): FiscalVatGroupMapping {
  return { ...DEFAULT_RO_MAPPING };
}

export function defaultItalianVatMapping(): FiscalVatGroupMapping {
  return { ...DEFAULT_IT_MAPPING };
}

export function defaultFiscalVatMappingForCountry(countryCode: string | null | undefined): FiscalVatGroupMapping {
  return normalizeFiscalCountryCode(countryCode) === 'IT'
    ? defaultItalianVatMapping()
    : defaultRomanianVatMapping();
}

/** @deprecated Use defaultFiscalVatMappingForCountry with restaurant fiscal country. */
export function defaultFiscalVatMappingForLocale(lang: string): FiscalVatGroupMapping {
  return lang === 'it' ? defaultItalianVatMapping() : defaultRomanianVatMapping();
}

export function mappingRowsFromRecord(mapping: FiscalVatGroupMapping): Array<{ percent: string; group: number }> {
  return Object.entries(mapping)
    .map(([percent, group]) => ({ percent, group }))
    .sort((a, b) => Number(b.percent) - Number(a.percent));
}

export function recordFromMappingRows(rows: Array<{ percent: string; group: number }>): FiscalVatGroupMapping {
  const result: FiscalVatGroupMapping = {};
  for (const row of rows) {
    const percent = row.percent.trim();
    const group = Number(row.group);
    if (!percent || !Number.isFinite(group) || group < 1 || group > 5)
      continue;
    result[percent] = group;
  }
  return result;
}
