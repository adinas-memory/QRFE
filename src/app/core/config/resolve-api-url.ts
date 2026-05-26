import { environment } from '../../../environments/environment';

/**
 * On LAN dev, nginx on :80 proxies /api and /sse. Kestrel is 127.0.0.1:7051 only.
 * Align apiUrl to page origin on nginx ports and on :8080/:4200 when using a local proxy.
 * Never align on Capacitor native (origin https://localhost).
 */
export function alignApiUrlWithPageHost(
  options?: { shouldAlign?: boolean; isNative?: boolean },
): string {
  const configured = environment.apiUrl.replace(/\/$/, '');

  if (typeof window === 'undefined') {
    return configured;
  }

  const isNative =
    options?.isNative ??
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.() === true;

  if (isNative) {
    return configured;
  }

  const shouldAlign =
    options?.shouldAlign ?? shouldAlignApiUrlInBrowser();

  if (!shouldAlign) {
    return configured;
  }

  try {
    const configuredUrl = new URL(configured);
    const pageHost = window.location.hostname;
    const pageOrigin = window.location.origin.replace(/\/$/, '');
    const directKestrelPort =
      configuredUrl.port === '7051' || configuredUrl.port === '7052';
    const hostMismatch = configuredUrl.hostname !== pageHost;

    if (hostMismatch || directKestrelPort) {
      (environment as { apiUrl: string }).apiUrl = pageOrigin;
      console.warn(`[QRFE] API URL aligned for nginx: ${configured} → ${pageOrigin}`);
      return pageOrigin;
    }
  } catch {
    // keep configured URL
  }

  return configured;
}

function shouldAlignApiUrlInBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const pagePort = window.location.port;
  // :8080 / :4200 require a local proxy (serve:devhost or ng serve + proxy.devhost.json).
  if (pagePort === '8080' || pagePort === '4200') return true;
  return pagePort === '' || pagePort === '80' || pagePort === '443';
}

void alignApiUrlWithPageHost();
