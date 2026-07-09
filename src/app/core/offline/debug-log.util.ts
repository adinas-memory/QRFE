import { Capacitor } from '@capacitor/core';
import { NetworkMonitor } from '../plugins/network-monitor.plugin';

const MAX_WEB_BUFFER = 500;
const MAX_WEB_STORAGE_LINES = 500;
const WEB_STORAGE_KEY = 'qrfe-debug-log';
const PERSIST_DEBOUNCE_MS = 2_000;
const webBuffer: string[] = [];
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistLines: string[] | null = null;

function shouldPersistToStorage(category: string, message: string): boolean {
  if (category === 'sse' && message === 'js heartbeat') {
    return false;
  }
  return true;
}

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

function flushPendingPersist(): void {
  persistTimer = null;
  if (!pendingPersistLines) {
    return;
  }
  const lines = pendingPersistLines;
  pendingPersistLines = null;
  persistWebLines(lines);
}

function schedulePersist(lines: string[]): void {
  pendingPersistLines = lines;
  if (persistTimer !== null) {
    return;
  }
  persistTimer = setTimeout(flushPendingPersist, PERSIST_DEBOUNCE_MS);
}

function appendWebLine(line: string, persist: boolean): void {
  webBuffer.push(line);
  while (webBuffer.length > MAX_WEB_BUFFER) {
    webBuffer.shift();
  }
  if (!persist) {
    return;
  }
  const merged = [...readStoredWebLines(), line].slice(-MAX_WEB_STORAGE_LINES);
  schedulePersist(merged);
}

function collectWebLogLines(): string[] {
  const stored = readStoredWebLines();
  if (webBuffer.length === 0) {
    return stored;
  }
  if (stored.length === 0) {
    return [...webBuffer];
  }
  const tail = webBuffer.slice(Math.max(0, webBuffer.length - 50));
  const merged = [...stored];
  for (const line of tail) {
    if (!merged.includes(line)) {
      merged.push(line);
    }
  }
  return merged.slice(-MAX_WEB_STORAGE_LINES);
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
    appendWebLine(line, shouldPersistToStorage(category, message));
  } catch {
    // best-effort
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

/** Download or share debug log on web/PWA. Returns line count exported (0 = nothing to export). */
export async function downloadWebDebugLog(): Promise<number> {
  if (typeof document === 'undefined') {
    return 0;
  }
  flushPendingPersist();
  const lines = collectWebLogLines();
  if (lines.length === 0) {
    return 0;
  }
  const content = lines.join('\n') + '\n';
  const filename = 'qrfe-debug.log';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([content], filename, { type: 'application/x-ndjson' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'QRFE debug log' });
        return lines.length;
      }
    } catch (err) {
      const aborted = (err as { name?: string })?.name === 'AbortError';
      if (aborted) {
        return lines.length;
      }
      // try download fallback
    }
  }

  try {
    const blob = new Blob([content], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return lines.length;
  } catch {
    const copied = await copyTextToClipboard(content);
    return copied ? lines.length : 0;
  }
}
