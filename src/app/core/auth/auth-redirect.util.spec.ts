import { getRoleHomeUrl } from './auth-redirect.util';

describe('auth-redirect.util', () => {
  it('routes reseller to /reseller', () => {
    expect(getRoleHomeUrl('reseller', false)).toBe('/reseller');
  });
});
