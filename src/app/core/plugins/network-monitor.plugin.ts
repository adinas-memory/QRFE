import { registerPlugin } from '@capacitor/core';

export interface NetworkMonitorPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (event: { online: boolean }) => void,
  ): Promise<{ remove: () => void }>;
}

export const NetworkMonitor = registerPlugin<NetworkMonitorPlugin>('NetworkMonitor');
