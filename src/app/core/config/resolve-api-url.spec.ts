import {
  isLocalStaticDevServer,
  isNginxFrontPort,
  isStaticDevServerPort,
} from './resolve-api-url';

describe('resolve-api-url helpers', () => {
  it('detects static dev ports on any host', () => {
    expect(isStaticDevServerPort('8080')).toBeTrue();
    expect(isStaticDevServerPort('4200')).toBeTrue();
    expect(isStaticDevServerPort('80')).toBeFalse();
  });

  it('detects nginx front ports', () => {
    expect(isNginxFrontPort('')).toBeTrue();
    expect(isNginxFrontPort('80')).toBeTrue();
    expect(isNginxFrontPort('443')).toBeTrue();
    expect(isNginxFrontPort('8080')).toBeFalse();
  });

  it('isLocalStaticDevServer is localhost + static port', () => {
    expect(isLocalStaticDevServer('localhost', '8080')).toBeTrue();
    expect(isLocalStaticDevServer('192.168.43.237', '8080')).toBeFalse();
    expect(isLocalStaticDevServer('localhost', '80')).toBeFalse();
  });
});
