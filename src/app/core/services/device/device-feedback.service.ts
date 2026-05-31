import { Injectable } from '@angular/core';
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
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',hypothesisId:'H2',location:'device-feedback.service.ts:deliverPickupReady',message:'pickup haptic decision',data:{kind,tableId,targetId,localId,outcome,hapticsEnabled:this.hapticsEnabled},timestamp:Date.now()})}).catch(()=>{});
    console.warn('[DEBUG-7379f5] haptic', outcome, { kind, tableId, targetId, localId });
    // #endregion
  }

  private async vibrate(durationMs: number): Promise<void> {
    if (this.platform.capabilities.hapticsBackend === 'capacitor-haptics') {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Medium });
        return;
      } catch {
        // fall through to web vibrate
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
