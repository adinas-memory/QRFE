import { environment } from '../../../environments/environment';

/**
 * Auth cookies are same-site only when the page host matches the API host.
 * On LAN dev, Kestrel listens on 127.0.0.1:7051/7052; nginx on :80 proxies /api and /sse.
 * Align apiUrl to the page origin (no :7051) so the browser hits nginx, not a refused LAN port.
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
    const configuredPort = configuredUrl.port;
    const directKestrelPort =
      configuredPort === '7051' || configuredPort === '7052' || (!configuredPort && configured.includes(':7051'));
    const hostMismatch = configuredUrl.hostname !== pageHost;
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'post-fix',location:'resolve-api-url.ts:entry',message:'alignApiUrlWithPageHost',data:{configured,pageHost,pagePort,pageOrigin,configuredPort,hostMismatch,directKestrelPort},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (hostMismatch || directKestrelPort) {
      const aligned = pageOrigin;
      (environment as { apiUrl: string }).apiUrl = aligned;
      console.warn(`[QRFE] API URL aligned for nginx/same-site: ${configured} → ${aligned}`);
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'post-fix',location:'resolve-api-url.ts:aligned',message:'apiUrl rewritten to page origin',data:{aligned},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      return aligned;
    }
  } catch {
    // keep configured URL
  }
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'post-fix',location:'resolve-api-url.ts:unchanged',message:'apiUrl kept configured',data:{configured},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  // #endregion
  return configured;
}

const resolvedApiUrl = alignApiUrlWithPageHost();

/** Debug: compare direct :7051 vs nginx same-origin reachability. */
function probeApiReachability(): void {
  if (typeof window === 'undefined') return;
  const aligned = environment.apiUrl.replace(/\/$/, '');
  const viaNginx = `${window.location.origin}/api/ping-lite`;
  const viaAligned = `${aligned}/api/ping-lite`;
  void Promise.all([
    fetch(viaAligned, { credentials: 'include' })
      .then(r => ({ route: 'aligned', ok: r.ok, status: r.status }))
      .catch(e => ({ route: 'aligned', ok: false, error: String(e) })),
    fetch(viaNginx, { credentials: 'include' })
      .then(r => ({ route: 'nginx-origin', ok: r.ok, status: r.status }))
      .catch(e => ({ route: 'nginx-origin', ok: false, error: String(e) })),
  ]).then(results => {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'post-fix',location:'resolve-api-url.ts:probe',message:'ping-lite reachability',data:{viaAligned, viaNginx, results},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
    // #endregion
  });
}

probeApiReachability();

void resolvedApiUrl;
