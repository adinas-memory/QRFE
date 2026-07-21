import { environment } from '../../../environments/environment';

const DEBUG_SESSION_ID = '654957';
const LOCAL_INGEST_URL = 'http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519';

export interface DebugSessionLogEntry {
  location: string;
  message: string;
  hypothesisId?: string;
  data?: unknown;
}

/** Sends debug logs to production API (+ optional local Cursor ingest). */
export function emitDebugSessionLog(entry: DebugSessionLogEntry): void {
  const payload = {
    sessionId: DEBUG_SESSION_ID,
    timestamp: Date.now(),
    ...entry,
  };

  const body = JSON.stringify(payload);

  fetch(`${environment.apiUrl.replace(/\/$/, '')}/api/debug/client-log`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(() => {});

  fetch(LOCAL_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body,
  }).catch(() => {});

  console.warn('[DEBUG-654957]', payload);
}
