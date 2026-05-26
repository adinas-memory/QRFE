import { environment } from '../../../environments/environment';
import { alignApiUrlWithPageHost } from './resolve-api-url';

describe('alignApiUrlWithPageHost', () => {
  const originalApiUrl = environment.apiUrl;

  afterEach(() => {
    (environment as { apiUrl: string }).apiUrl = originalApiUrl;
  });

  it('does not rewrite apiUrl on native Capacitor', () => {
    (environment as { apiUrl: string }).apiUrl = 'https://unrsystem.go.ro';
    const result = alignApiUrlWithPageHost({ isNative: true, shouldAlign: true });
    expect(result).toBe('https://unrsystem.go.ro');
    expect(environment.apiUrl).toBe('https://unrsystem.go.ro');
  });
});
