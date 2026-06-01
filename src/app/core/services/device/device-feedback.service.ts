import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../environments/environment';
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
    let outcome = 'unknown';

    if (!this.hapticsEnabled) {
      outcome = 'haptics_disabled';
    } else if (!targetId) {
      outcome = 'no_target_id';
    } else if (!tableId) {
      outcome = 'no_table_id';
    } else if (!localId || !clientInstanceIdsMatch(targetId, localId)) {
      outcome = 'id_mismatch';
    } else {
      const now = Date.now();
      const last = this.lastVibrateAtByTable.get(`${kind}:${tableId}`) ?? 0;
      if (now - last < DEBOUNCE_MS) {
        outcome = 'debounced';
      } else {
        this.lastVibrateAtByTable.set(`${kind}:${tableId}`, now);
        await this.vibrate(PICKUP_VIBRATE_MS);
        outcome = 'vibrated';
      }
    }

    // #region agent log
    this.postAgentDebug('H2', 'device-feedback.service.ts:deliverPickupReady', 'pickup haptic decision', { kind, tableId, targetId, localId, outcome, hapticsEnabled: this.hapticsEnabled, native: Capacitor.isNativePlatform() });
    console.warn('[DEBUG-7379f5] haptic', outcome, { kind, tableId, targetId, localId });
    // #endregion
  }

  private async deliverPickupFromPush(kind: PickupReadyKind, tableId: string): Promise<void> {
    const normalizedTableId = tableId?.trim();
    let outcome = 'unknown';

    if (!this.hapticsEnabled) {
      outcome = 'haptics_disabled';
    } else if (!normalizedTableId) {
      outcome = 'no_table_id';
    } else {
      const now = Date.now();
      const last = this.lastVibrateAtByTable.get(`${kind}:${normalizedTableId}`) ?? 0;
      if (now - last < DEBOUNCE_MS) {
        outcome = 'debounced';
      } else {
        this.lastVibrateAtByTable.set(`${kind}:${normalizedTableId}`, now);
        await this.vibrate(PICKUP_VIBRATE_MS);
        outcome = 'vibrated_push';
      }
    }

    // #region agent log
    this.postAgentDebug('H11', 'device-feedback.service.ts:deliverPickupFromPush', 'push haptic decision', { kind, tableId: normalizedTableId, outcome, hapticsEnabled: this.hapticsEnabled, native: Capacitor.isNativePlatform() });
    console.warn('[DEBUG-7379f5] push haptic', outcome, { kind, tableId: normalizedTableId });
    // #endregion
  }

  private postAgentDebug(hypothesisId: string, location: string, message: string, data: unknown): void {
    const payload = { sessionId: '7379f5', hypothesisId, location, message, data, timestamp: Date.now() };
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify(payload)}).catch(()=>{});
    if (Capacitor.isNativePlatform()) {
      fetch(`${environment.apiUrl}/api/debug/agent-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: '7379f5', hypothesisId, location, message, data }),
      }).catch(() => {});
    }
  }

  private async vibrate(durationMs: number): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        const { PickupVibrate } = await import('../../plugins/pickup-vibrate.plugin');
        await PickupVibrate.pulse();
        return;
      } catch {
        // fall through to Capacitor Haptics
      }
    }

    if (this.platform.capabilities.hapticsBackend === 'capacitor-haptics') {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.vibrate({ duration: durationMs });
        return;
      } catch {
        try {
          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
          await Haptics.impact({ style: ImpactStyle.Heavy });
          return;
        } catch {
          // fall through to web vibrate
        }
      }
    }
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch {
      // ignore
    }
  }
}
