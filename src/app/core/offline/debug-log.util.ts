import { Capacitor } from '@capacitor/core';
import { NetworkMonitor } from '../plugins/network-monitor.plugin';

const MAX_WEB_BUFFER = 500;
const MAX_WEB_STORAGE_LINES = 2000;
const WEB_STORAGE_KEY = 'qrfe-debug-log';
const webBuffer: string[] = [];

function readStoredWebLines(): string[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((line): line is string => typeof line === 'string') : [];
  } catch {
    return [];
  }
}

function persistWebLines(lines: string[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(lines.slice(-MAX_WEB_STORAGE_LINES)));
  } catch {
    // quota or private mode — keep in-memory buffer only
  }
}

function appendWebLine(line: string): void {
  webBuffer.push(line);
  while (webBuffer.length > MAX_WEB_BUFFER) {
    webBuffer.shift();
  }
  const merged = [...readStoredWebLines(), line].slice(-MAX_WEB_STORAGE_LINES);
  persistWebLines(merged);
}

/** On-device NDJSON log (native) or persisted ring buffer (web/PWA). No network dependency. */
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
    appendWebLine(line);
  } catch {
    // best-effort
  }
}

export function downloadWebDebugLog(): number {
  if (typeof document === 'undefined') {
    return 0;
  }
  const stored = readStoredWebLines();
  const lines = stored.length > 0 ? stored : [...webBuffer];
  if (lines.length === 0) {
    return 0;
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'qrfe-debug.log';
  anchor.click();
  URL.revokeObjectURL(url);
  return lines.length;
}
