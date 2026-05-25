import { isLocalStaticDevServer } from './resolve-api-url';

describe('isLocalStaticDevServer', () => {
  it('treats localhost:8080 and :4200 as static-only (no nginx /api)', () => {
    expect(isLocalStaticDevServer('localhost', '8080')).toBeTrue();
    expect(isLocalStaticDevServer('127.0.0.1', '4200')).toBeTrue();
  });

  it('allows localhost:80 as potential nginx front', () => {
    expect(isLocalStaticDevServer('localhost', '80')).toBeFalse();
    expect(isLocalStaticDevServer('localhost', '')).toBeFalse();
  });

  it('does not apply to LAN hosts', () => {
    expect(isLocalStaticDevServer('192.168.43.142', '80')).toBeFalse();
    expect(isLocalStaticDevServer('192.168.43.142', '')).toBeFalse();
  });
});
