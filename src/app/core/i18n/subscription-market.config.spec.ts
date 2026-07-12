import { marketFromLang } from './subscription-market.config';

describe('subscription-market.config', () => {
  it('maps ro to RO', () => {
    expect(marketFromLang('ro')).toBe('RO');
  });

  it('maps it to IT', () => {
    expect(marketFromLang('it')).toBe('IT');
  });

  it('maps en to US', () => {
    expect(marketFromLang('en')).toBe('US');
  });

  it('falls back unsupported langs to US', () => {
    expect(marketFromLang('fr')).toBe('US');
    expect(marketFromLang('de')).toBe('US');
  });
});
