/** Debug-only printer settings tracing (session 7379f5). */
export function printerSettingsDebugLog(
  hypothesisId: string,
  location: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  const payload = { sessionId: '7379f5', hypothesisId, location, message, data, timestamp: Date.now() };
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}
