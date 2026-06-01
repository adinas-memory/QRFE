import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { pickupDebugLog } from '../../debug/pickup-debug.log';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { PlatformStorageService } from '../../platform/platform-storage.service';
import { ClientInstanceService, clientInstanceIdsMatch } from './client-instance.service';

const PICKUP_VIBRATE_MS = 500;
const DEBOUNCE_MS = 2000;

export type PickupReadyKind = 'kitchen' | 'bar';

export interface PickupReadyNotifyOptions {
  tableId: string;
  clientInstanceId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DeviceFeedbackService {
  private readonly lastVibrateAtByTable = new Map<string, number>();
  private hapticsEnabledCache = true;

  constructor(
    private readonly clientInstance: ClientInstanceService,
    private readonly platform: RuntimePlatformService,
    private readonly platformStorage: PlatformStorageService,
  ) {
    void this.platformStorage.getHapticsEnabled().then((v) => {
      this.hapticsEnabledCache = v;
    });
  }

  get hapticsEnabled(): boolean {
    return this.hapticsEnabledCache;
  }

  setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabledCache = enabled;
    void this.platformStorage.setHapticsEnabled(enabled);
  }

  /**
   * Vibrate only when the SSE/FCM payload targets this device's client instance id.
   * Waits for Capacitor Preferences id before comparing (same rules as b8e1d845).
   */
  notifyPickupReady(kind: PickupReadyKind, options: PickupReadyNotifyOptions): void {
    void this.deliverPickupReady(kind, options);
  }

  /** FCM/SSE on this device — token or connection already implies delivery; skip ClientInstanceId gate. */
  notifyPickupFromPush(kind: PickupReadyKind, tableId: string): void {
    void this.deliverPickupFromPush(kind, tableId);
  }

  private async deliverPickupReady(
    kind: PickupReadyKind,
    options: PickupReadyNotifyOptions,
  ): Promise<void> {
    const targetId = (options.clientInstanceId ?? '').trim();
    const tableId = options.tableId?.trim();
    const localId = await this.clientInstance.whenReady();

    if (!this.hapticsEnabled || !targetId || !tableId) {
      pickupDebugLog('H-VIB2', 'device-feedback:deliverPickupReady', 'haptic skip', {
        reason: !this.hapticsEnabled ? 'disabled' : !targetId ? 'no_target' : 'no_table',
        kind, tableId, targetId,
      });
      return;
    }
    if (!localId || !clientInstanceIdsMatch(targetId, localId)) {
      pickupDebugLog('H-VIB2', 'device-feedback:deliverPickupReady', 'haptic skip', {
        reason: 'id_mismatch', kind, tableId, targetId, localId,
      });
      return;
    }

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${tableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      pickupDebugLog('H-VIB2', 'device-feedback:deliverPickupReady', 'haptic skip', { reason: 'debounced', kind, tableId });
      return;
    }

    this.lastVibrateAtByTable.set(`${kind}:${tableId}`, now);
    const via = await this.vibrate(PICKUP_VIBRATE_MS);
    pickupDebugLog('H-VIB2', 'device-feedback:deliverPickupReady', 'haptic fired', { kind, tableId, via });
  }

  private async deliverPickupFromPush(kind: PickupReadyKind, tableId: string): Promise<void> {
    const normalizedTableId = tableId?.trim();
    if (!this.hapticsEnabled || !normalizedTableId) {
      pickupDebugLog('H-VIB3', 'device-feedback:deliverPickupFromPush', 'haptic skip', {
        reason: !this.hapticsEnabled ? 'disabled' : 'no_table', kind, tableId: normalizedTableId,
      });
      return;
    }

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${normalizedTableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      pickupDebugLog('H-VIB3', 'device-feedback:deliverPickupFromPush', 'haptic skip', { reason: 'debounced', kind, tableId: normalizedTableId });
      return;
    }

    this.lastVibrateAtByTable.set(`${kind}:${normalizedTableId}`, now);
    const via = await this.vibrate(PICKUP_VIBRATE_MS);
    pickupDebugLog('H-VIB3', 'device-feedback:deliverPickupFromPush', 'haptic fired', { kind, tableId: normalizedTableId, via });
  }

  private async vibrate(durationMs: number): Promise<string> {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
        return 'navigator';
      }
    } catch {
      // ignore
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const { PickupVibrate } = await import('../../plugins/pickup-vibrate.plugin');
        await PickupVibrate.pulse();
        return 'native-plugin';
      } catch {
        // fall through
      }
    }

    if (this.platform.capabilities.hapticsBackend === 'capacitor-haptics') {
      try {
        const { Haptics } = await import('@capacitor/haptics');
        await Haptics.vibrate({ duration: durationMs });
        return 'capacitor-haptics';
      } catch {
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Heavy });
          return 'capacitor-impact';
        } catch {
          // fall through
        }
      }
    }
    return 'none';
  }
}
