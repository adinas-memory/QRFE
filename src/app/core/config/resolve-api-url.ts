import { environment } from '../../../environments/environment';

/**
 * Auth cookies are same-site only when the page host matches the API host.
 * If devhost build (LAN IP) is opened on localhost, rewrite API to localhost:7051.
 */
export function alignApiUrlWithPageHost(): string {
  const configured = environment.apiUrl.replace(/\/$/, '');
  if (typeof window === 'undefined') {
    return configured;
  }
  try {
    const configuredUrl = new URL(configured);
    const pageHost = window.location.hostname;
    if (configuredUrl.hostname !== pageHost) {
      const port = configuredUrl.port || '7051';
      const aligned = `${configuredUrl.protocol}//${pageHost}:${port}`;
      (environment as { apiUrl: string }).apiUrl = aligned;
      console.warn(`[QRFE] API URL aligned for auth cookies: ${configured} → ${aligned}`);
      return aligned;
    }
  } catch {
    // keep configured URL
  }
  return configured;
}

alignApiUrlWithPageHost();
