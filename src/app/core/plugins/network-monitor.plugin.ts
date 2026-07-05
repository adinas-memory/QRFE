import { registerPlugin } from '@capacitor/core';

export interface NetworkMonitorPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (event: { online: boolean }) => void,
  ): Promise<{ remove: () => void }>;
  // #region agent log
  /** Debug session e48331 only — writes NDJSON line to a local file (no network dependency). */
  writeDebugLog(options: {
    hypothesisId: string;
    location: string;
    message: string;
    dataJson: string;
  }): Promise<void>;
  /** Debug session e48331 only — opens Android share sheet with the on-device log file. */
  shareDebugLog(): Promise<void>;
  // #endregion
}

export const NetworkMonitor = registerPlugin<NetworkMonitorPlugin>('NetworkMonitor');
