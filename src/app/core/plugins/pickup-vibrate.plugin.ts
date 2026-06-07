import { registerPlugin } from '@capacitor/core';

export interface NotificationChannelStatus {
  supported: boolean;
  sdkInt: number;
  channelId?: string;
  channelExists?: boolean;
  importance?: number;
  sound?: string;
  vibrationEnabled?: boolean;
  error?: string;
}

export interface PickupVibratePlugin {
  pulse(): Promise<void>;
  getWaiterCallChannelStatus(): Promise<NotificationChannelStatus>;
  openWaiterCallChannelSettings(): Promise<void>;
  ensureGuestWaiterChannel(options: {
    restaurantId: string;
    restaurantName?: string | null;
  }): Promise<{ channelId: string }>;
  getGuestWaiterChannelStatus(options: { restaurantId: string }): Promise<NotificationChannelStatus>;
  openGuestWaiterChannelSettings(options: { restaurantId: string }): Promise<void>;
}

export const PickupVibrate = registerPlugin<PickupVibratePlugin>('PickupVibrate');
