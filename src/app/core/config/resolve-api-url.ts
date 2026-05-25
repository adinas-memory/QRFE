import { environment } from '../../../environments/environment';

/**
 * API routing:
 * - LAN nginx (:80): align apiUrl to page origin — /api and /sse are proxied on the same host.
 * - Static dev (:8080, :4200): same-origin + dev proxy (see scripts/static-with-proxy.mjs or ng serve --proxy-config).
 * - Never point apiUrl at :8080 without a proxy — http-server alone returns 404 for /sse and /api.
 */
export function alignApiUrlWithPageHost(): string {
  const configured = environment.apiUrl.replace(/\/$/, '');
  if (typeof window === 'undefined') {
    return configured;
  }
  try {
    const configuredUrl = new URL(configured);
    const pageHost = window.location.hostname;
    const pagePort = window.location.port;
    const pageOrigin = window.location.origin.replace(/\/$/, '');
    const staticDevPort = isStaticDevServerPort(pagePort);
    const nginxFront = isNginxFrontPort(pagePort);
    const directKestrelPort =
      configuredUrl.port === '7051' || configuredUrl.port === '7052';
    const hostMismatch = configuredUrl.hostname !== pageHost;

    // :8080 / :4200 on any host (127.0.0.1, 192.168.x.x): use same-origin; dev server must proxy /api + /sse.
    const shouldAlign =
      staticDevPort ||
      (nginxFront && (hostMismatch || directKestrelPort));

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-proxy',location:'resolve-api-url.ts:entry',message:'alignApiUrlWithPageHost',data:{configured,pageHost,pagePort,pageOrigin,staticDevPort,nginxFront,hostMismatch,directKestrelPort,shouldAlign},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
    // #endregion

    if (shouldAlign) {
      (environment as { apiUrl: string }).apiUrl = pageOrigin;
      const hint = staticDevPort
        ? 'Use "npm run serve:devhost" (includes API proxy), not plain http-server.'
        : 'nginx/same-site';
      console.warn(`[QRFE] API URL → ${pageOrigin} (${hint})`);
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-proxy',location:'resolve-api-url.ts:aligned',message:'apiUrl rewritten',data:{aligned:pageOrigin,staticDevPort},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
      // #endregion
      return pageOrigin;
    }
  } catch {
    // keep configured URL
  }
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-proxy',location:'resolve-api-url.ts:unchanged',message:'apiUrl kept configured',data:{configured},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
  // #endregion
  return configured;
}

/** http-server / ng serve ports without built-in API — use static-with-proxy or ng proxy-config. */
export function isStaticDevServerPort(pagePort: string): boolean {
  return pagePort === '8080' || pagePort === '4200';
}

export function isNginxFrontPort(pagePort: string): boolean {
  return pagePort === '' || pagePort === '80' || pagePort === '443';
}

/** @deprecated Use isStaticDevServerPort */
export function isLocalStaticDevServer(pageHost: string, pagePort: string): boolean {
  return (
    (pageHost === 'localhost' || pageHost === '127.0.0.1') &&
    isStaticDevServerPort(pagePort)
  );
}

const resolvedApiUrl = alignApiUrlWithPageHost();

function probeApiReachability(): void {
  if (typeof window === 'undefined') return;
  const base = environment.apiUrl.replace(/\/$/, '');
  const ping = `${base}/api/ping-lite`;
  void fetch(ping, { credentials: 'include' })
    .then(r => ({ ok: r.ok, status: r.status }))
    .catch(e => ({ ok: false, error: String(e) }))
    .then(result => {
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-proxy',location:'resolve-api-url.ts:probe',message:'ping-lite',data:{ping,result},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
      // #endregion
    });
}

probeApiReachability();

void resolvedApiUrl;
