import { resolveFiscalErrorInfo } from './fiscal-error-catalog';

describe('resolveFiscalErrorInfo', () => {
  const t = (key: string, params?: Record<string, unknown>) => {
    if (params?.['code'] != null) {
      return `${key}:${params['code']}`;
    }
    return key;
  };

  it('translates FPMATE_UNREACHABLE via i18n keys', () => {
    const info = resolveFiscalErrorInfo('FPMATE_UNREACHABLE', t);
    expect(info.title).toBe('restaurantSettings.fiscalPrinter.errors.FPMATE_UNREACHABLE.title');
    expect(info.steps).toEqual([
      'restaurantSettings.fiscalPrinter.errors.FPMATE_UNREACHABLE.step1',
    ]);
  });

  it('translates unknown codes with code param', () => {
    const info = resolveFiscalErrorInfo('SOME_NEW_CODE', t);
    expect(info.title).toBe('restaurantSettings.fiscalPrinter.errors.unknown.title:SOME_NEW_CODE');
    expect(info.steps).toEqual(['restaurantSettings.fiscalPrinter.errors.unknown.step1']);
  });

  it('keeps Romanian catalog entries for DATECS codes', () => {
    const info = resolveFiscalErrorInfo('DATECS_33022', t);
    expect(info.title).toContain('Casa de marcat');
  });
});
