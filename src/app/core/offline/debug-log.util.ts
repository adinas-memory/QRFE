import { Capacitor } from '@capacitor/core';
import { NetworkMonitor } from '../plugins/network-monitor.plugin';

const MAX_WEB_BUFFER = 500;
const webBuffer: string[] = [];

/** On-device NDJSON log (native) or in-memory ring buffer (web). No network dependency. */
export function debugLog(category: string, location: string, message: string, data?: unknown): void {
  const line = JSON.stringify({
    category,
    location,
    message,
    data: data ?? {},
    timestamp: Date.now(),
  });

  if (Capacitor.isNativePlatform()) {
    void NetworkMonitor.writeDebugLog({
      category,
      location,
      message,
      dataJson: JSON.stringify(data ?? {}),
    }).catch(() => {});
    return;
  }

  try {
    webBuffer.push(line);
    while (webBuffer.length > MAX_WEB_BUFFER) {
      webBuffer.shift();
    }
  } catch {
    // best-effort
  }
}

export function downloadWebDebugLog(): void {
  if (typeof document === 'undefined' || webBuffer.length === 0) {
    return;
  }
  const blob = new Blob([webBuffer.join('\n') + '\n'], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'qrfe-debug.log';
  anchor.click();
  URL.revokeObjectURL(url);
}
