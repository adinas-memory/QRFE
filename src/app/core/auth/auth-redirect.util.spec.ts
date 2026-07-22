import {
  getRoleHomeUrl,
  isReturnUrlAllowedForRole,
  resolvePostLoginUrl,
  sanitizeReturnUrl,
} from './auth-redirect.util';

describe('auth-redirect.util', () => {
  it('routes reseller to /reseller', () => {
    expect(getRoleHomeUrl('reseller', false)).toBe('/reseller');
  });

  it('routes manager to /manager', () => {
    expect(getRoleHomeUrl('manager', false)).toBe('/manager');
  });

  describe('sanitizeReturnUrl', () => {
    it('rejects external and auth-loop URLs', () => {
      expect(sanitizeReturnUrl('//evil.com')).toBeNull();
      expect(sanitizeReturnUrl('/login')).toBeNull();
      expect(sanitizeReturnUrl('/register')).toBeNull();
    });

    it('accepts internal protected paths', () => {
      expect(sanitizeReturnUrl('/reseller')).toBe('/reseller');
      expect(sanitizeReturnUrl('/manager/dashboard')).toBe('/manager/dashboard');
    });
  });

  describe('isReturnUrlAllowedForRole', () => {
    it('allows reseller on /reseller', () => {
      expect(isReturnUrlAllowedForRole('/reseller', 'reseller')).toBeTrue();
    });

    it('denies manager on /reseller', () => {
      expect(isReturnUrlAllowedForRole('/reseller', 'manager')).toBeFalse();
    });

    it('allows manager on /manager and /staff', () => {
      expect(isReturnUrlAllowedForRole('/manager', 'manager')).toBeTrue();
      expect(isReturnUrlAllowedForRole('/staff/manage-orders', 'manager')).toBeTrue();
    });

    it('allows any role on public paths', () => {
      expect(isReturnUrlAllowedForRole('/faq', 'manager')).toBeTrue();
    });
  });

  describe('resolvePostLoginUrl', () => {
    it('uses returnUrl when role matches', () => {
      expect(resolvePostLoginUrl('reseller', false, '/reseller')).toBe('/reseller');
    });

    it('falls back to role home when returnUrl is for another role (reseller login, manager account)', () => {
      expect(resolvePostLoginUrl('manager', false, '/reseller')).toBe('/manager');
    });

    it('falls back when returnUrl is missing', () => {
      expect(resolvePostLoginUrl('staff', false, null)).toBe('/staff');
    });
  });
});
