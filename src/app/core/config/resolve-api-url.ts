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

const __alignedApiUrl = alignApiUrlWithPageHost();
if (typeof window !== 'undefined') {
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'resolve-api-url.ts:boot',message:'api url resolved',data:{pageOrigin:window.location.origin,pageHost:window.location.hostname,pagePort:window.location.port,apiUrl:__alignedApiUrl,swOff:('serviceWorker' in environment && (environment as { serviceWorker?: boolean }).serviceWorker===false)},timestamp:Date.now(),hypothesisId:'H-LAN'})}).catch(()=>{});
  // #endregion
}
