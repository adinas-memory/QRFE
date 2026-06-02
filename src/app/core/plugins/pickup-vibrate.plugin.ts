import { registerPlugin } from '@capacitor/core';

export interface PickupVibratePlugin {
  pulse(): Promise<void>;
  getWaiterCallChannelStatus(): Promise<{
    supported: boolean;
    sdkInt: number;
    channelExists?: boolean;
    importance?: number;
    sound?: string;
    vibrationEnabled?: boolean;
    error?: string;
  }>;
  openWaiterCallChannelSettings(): Promise<void>;
}

export const PickupVibrate = registerPlugin<PickupVibratePlugin>('PickupVibrate');
