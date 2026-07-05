import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { ClientInstanceService, clientInstanceIdsMatch } from './client-instance.service';
// #region agent log
import { debugLog } from '../../offline/debug-log.util';
// #endregion

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

  constructor(
    private readonly clientInstance: ClientInstanceService,
    private readonly platform: RuntimePlatformService,
  ) {}

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

  /** Guest waiter call — broadcast to all staff devices (no ClientInstanceId gate). */
  notifyGuestWaiterCall(tableId: string): void {
    void this.deliverGuestWaiterCall(tableId);
  }

  private async deliverPickupReady(
    kind: PickupReadyKind,
    options: PickupReadyNotifyOptions,
  ): Promise<void> {
    const targetId = (options.clientInstanceId ?? '').trim();
    const tableId = options.tableId?.trim();
    const localId = await this.clientInstance.whenReady();
    const matches = !!localId && clientInstanceIdsMatch(targetId, localId);
    // #region agent log
    debugLog('H_VIBRATE_1', 'device-feedback.service.ts:deliverPickupReady', 'pickup target check', {
      kind, tableId, targetId, localId, matches,
    });
    // #endregion

    if (!targetId || !tableId) {
      return;
    }
    if (!matches) {
      return;
    }

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${tableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      return;
    }

    this.lastVibrateAtByTable.set(`${kind}:${tableId}`, now);
    const usedBackend = await this.vibrate(PICKUP_VIBRATE_MS);
    // #region agent log
    debugLog('H_VIBRATE_1', 'device-feedback.service.ts:deliverPickupReady', 'vibrate outcome', {
      kind, tableId, usedBackend,
    });
    // #endregion
  }

  private async deliverPickupFromPush(kind: PickupReadyKind, tableId: string): Promise<void> {
    const normalizedTableId = tableId?.trim();
    if (!normalizedTableId) {
      return;
    }

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${normalizedTableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      return;
    }

    this.lastVibrateAtByTable.set(`${kind}:${normalizedTableId}`, now);
    await this.vibrate(PICKUP_VIBRATE_MS);
  }

  private async deliverGuestWaiterCall(tableId: string): Promise<void> {
    const normalizedTableId = tableId?.trim();
    if (!normalizedTableId) {
      return;
    }

    const now = Date.now();
    const debounceKey = `guest:${normalizedTableId}`;
    const last = this.lastVibrateAtByTable.get(debounceKey) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      return;
    }

    this.lastVibrateAtByTable.set(debounceKey, now);
    await this.vibrate(PICKUP_VIBRATE_MS);
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
      } catch (err) {
        // #region agent log
        debugLog('H_VIBRATE_1', 'device-feedback.service.ts:vibrate', 'native-plugin failed', {
          error: String((err as Error)?.message ?? err),
        });
        // #endregion
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
