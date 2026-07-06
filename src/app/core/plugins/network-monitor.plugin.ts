import { registerPlugin } from '@capacitor/core';

export interface NetworkMonitorPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (event: { online: boolean }) => void,
  ): Promise<{ remove: () => void }>;
  writeDebugLog(options: {
    category: string;
    location: string;
    message: string;
    dataJson: string;
  }): Promise<void>;
  shareDebugLog(): Promise<void>;
}

export const NetworkMonitor = registerPlugin<NetworkMonitorPlugin>('NetworkMonitor');
