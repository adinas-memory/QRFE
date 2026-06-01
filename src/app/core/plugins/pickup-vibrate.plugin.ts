import { registerPlugin } from '@capacitor/core';

export interface PickupVibratePlugin {
  pulse(): Promise<void>;
}

export const PickupVibrate = registerPlugin<PickupVibratePlugin>('PickupVibrate');
