import { isSetMenuOrderLine } from './setMenu';

describe('isSetMenuOrderLine', () => {
  const linked = 'linked-uuid';

  it('matches linked menu item id', () => {
    expect(isSetMenuOrderLine(linked, 'Appetizer', linked)).toBe(true);
  });

  it('matches SetMenu category string and enum index', () => {
    expect(isSetMenuOrderLine('x', 'SetMenu', null)).toBe(true);
    expect(isSetMenuOrderLine('x', 16, null)).toBe(true);
    expect(isSetMenuOrderLine('x', '16', null)).toBe(true);
  });

  it('does not match regular food lines', () => {
    expect(isSetMenuOrderLine('x', 'Appetizer', linked)).toBe(false);
  });
});
