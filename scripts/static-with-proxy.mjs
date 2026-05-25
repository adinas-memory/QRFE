/**
 * Serves dist/browser and proxies /api + /sse to the LAN dev API (nginx on :80).
 * Usage: node scripts/static-with-proxy.mjs
 * Env: QR_API_PROXY_TARGET=http://192.168.43.142  PORT=8080
 */
import { createServer, request as httpRequest } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_TARGET = (process.env.QR_API_PROXY_TARGET || 'http://192.168.43.142').replace(/\/$/, '');
const PORT = Number(process.env.PORT || 8080);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../dist/browser');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function shouldProxy(pathname) {
  return pathname.startsWith('/api') || pathname.startsWith('/sse');
}

function proxyToApi(req, res) {
  const target = new URL(req.url, API_TARGET);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  const proxyReq = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    proxyRes => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', err => {
    console.error('[proxy]', req.method, req.url, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end(`Bad gateway: ${err.message}`);
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let path = req.url?.split('?')[0] ?? '/';
  if (path === '/') path = '/index.html';
  const file = join(ROOT, path);
  const fallback = join(ROOT, 'index.html');

  try {
    const resolved = existsSync(file) && statSync(file).isFile() ? file : fallback;
    const body = readFileSync(resolved);
    const type = MIME[extname(resolved)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

createServer((req, res) => {
  const pathname = req.url?.split('?')[0] ?? '/';
  if (shouldProxy(pathname)) {
    proxyToApi(req, res);
    return;
  }
  serveStatic(req, res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[QRFE] Static + API proxy → ${API_TARGET}`);
  console.log(`[QRFE] Serving ${ROOT}`);
  console.log(`[QRFE] http://127.0.0.1:${PORT}`);
});
