import { environment } from '../../../environments/environment';

/**
 * Auth cookies are same-site only when the page host matches the API host.
 * On LAN dev, Kestrel listens on 127.0.0.1:7051/7052; nginx on :80 proxies /api and /sse.
 * Align apiUrl to the page origin only in that case — never when serving static files on
 * localhost:8080 (http-server has no /api or /sse; SW would return 404/405).
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
    const localStaticOnly = isLocalStaticDevServer(pageHost, pagePort);
    const directKestrelPort =
      configuredUrl.port === '7051' || configuredUrl.port === '7052';
    const hostMismatch = configuredUrl.hostname !== pageHost;
    const nginxFrontPort = pagePort === '' || pagePort === '80' || pagePort === '443';
    const shouldAlign =
      !localStaticOnly &&
      nginxFrontPort &&
      (hostMismatch || directKestrelPort);

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-fix',location:'resolve-api-url.ts:entry',message:'alignApiUrlWithPageHost',data:{configured,pageHost,pagePort,pageOrigin,localStaticOnly,hostMismatch,directKestrelPort,nginxFrontPort,shouldAlign},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
    // #endregion

    if (shouldAlign) {
      (environment as { apiUrl: string }).apiUrl = pageOrigin;
      console.warn(`[QRFE] API URL aligned for nginx/same-site: ${configured} → ${pageOrigin}`);
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-fix',location:'resolve-api-url.ts:aligned',message:'apiUrl rewritten',data:{aligned:pageOrigin},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
      // #endregion
      return pageOrigin;
    }
  } catch {
    // keep configured URL
  }
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-fix',location:'resolve-api-url.ts:unchanged',message:'apiUrl kept configured',data:{configured},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
  // #endregion
  return configured;
}

/** localhost:8080 / :4200 etc. — static dev server, not nginx API proxy. */
export function isLocalStaticDevServer(pageHost: string, pagePort: string): boolean {
  if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
    return false;
  }
  return pagePort !== '' && pagePort !== '80' && pagePort !== '443';
}

const resolvedApiUrl = alignApiUrlWithPageHost();

/** Debug: compare configured API vs page-origin reachability. */
function probeApiReachability(): void {
  if (typeof window === 'undefined') return;
  const aligned = environment.apiUrl.replace(/\/$/, '');
  const viaNginx = `${window.location.origin}/api/ping-lite`;
  const viaConfigured = `${aligned}/api/ping-lite`;
  void Promise.all([
    fetch(viaConfigured, { credentials: 'include' })
      .then(r => ({ route: 'configured', ok: r.ok, status: r.status }))
      .catch(e => ({ route: 'configured', ok: false, error: String(e) })),
    fetch(viaNginx, { credentials: 'include' })
      .then(r => ({ route: 'page-origin', ok: r.ok, status: r.status }))
      .catch(e => ({ route: 'page-origin', ok: false, error: String(e) })),
  ]).then(results => {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'api-url-fix',location:'resolve-api-url.ts:probe',message:'ping-lite reachability',data:{viaConfigured, viaNginx, results},timestamp:Date.now(),hypothesisId:'H-SSE-404'})}).catch(()=>{});
    // #endregion
  });
}

probeApiReachability();

void resolvedApiUrl;
