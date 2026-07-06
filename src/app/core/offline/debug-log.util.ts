// #region agent log
// Debug session e48331 — shared logger. Native (Android) writes to a local NDJSON file
// (exportable via the in-app "EXPORT LOG" button, no network dependency — production
// phones use mobile data and cannot reach the dev machine). Web (desktop browser on the
// same dev machine, used for multi-account manager/staff testing) posts to the local
// ingest server instead, since 127.0.0.1 IS reachable in that case.
import { Capacitor } from '@capacitor/core';
import { NetworkMonitor } from '../plugins/network-monitor.plugin';

const DEBUG_INGEST_URL = 'http://192.168.43.142:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16';
const SESSION_ID = 'e48331';

export function debugLog(hypothesisId: string, location: string, message: string, data: unknown): void {
  if (Capacitor.isNativePlatform()) {
    void NetworkMonitor.writeDebugLog({
      hypothesisId,
      location,
      message,
      dataJson: JSON.stringify(data ?? {}),
    }).catch(() => {});
    return;
  }

  void fetch(DEBUG_INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      hypothesisId,
      location,
      message,
      data: data ?? {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion
