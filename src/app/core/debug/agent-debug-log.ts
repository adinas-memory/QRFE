/** Debug-session logger: works on production HTTPS (sessionStorage + console); also tries local ingest. */
const SESSION_ID = 'bb1efa';
const STORAGE_KEY = 'debug-bb1efa';
const INGEST = 'http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519';

export function agentDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown> = {},
  runId = 'pre-fix',
): void {
  const payload = {
    sessionId: SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };

  try {
    const prev = sessionStorage.getItem(STORAGE_KEY);
    const arr = prev ? (JSON.parse(prev) as unknown[]) : [];
    if (!Array.isArray(arr)) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([payload]));
    } else {
      arr.push(payload);
      // keep last 80 entries
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-80)));
    }
  } catch {
    // ignore quota / private mode
  }

  // Distinctive console line for DevTools copy on production
  console.info(`__DEBUG_${SESSION_ID}__`, JSON.stringify(payload));

  fetch(INGEST, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function clearAgentDebugLogs(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Production helper: in DevTools run `copy(window.__dumpDebugBb1efa())` then paste here. */
declare global {
  interface Window {
    __dumpDebugBb1efa?: () => string;
    __clearDebugBb1efa?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.__dumpDebugBb1efa = () => sessionStorage.getItem(STORAGE_KEY) ?? '[]';
  window.__clearDebugBb1efa = () => clearAgentDebugLogs();
}
