export const environment = {
  production: true,
  /** LAN nginx deploy: no ngsw (avoids 502 on /api via stale worker after redeploys). */
  serviceWorker: false,
  // LAN dev: open http://<server-ip>/ (nginx :80). API is proxied at /api — not :7051 (Kestrel is 127.0.0.1 only).
  apiUrl: 'http://192.168.0.17',
  poweredBy: 'QRFE Dev LAN',
  printerAgentDownloadUrl:
    'https://github.com/adrian-badulescu/Printer-Agent/releases/download/v1.2.4/URSPrinterAgentSetup.exe',
};
