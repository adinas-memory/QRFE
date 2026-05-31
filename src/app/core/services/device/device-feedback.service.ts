import { Injectable } from '@angular/core';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { PlatformStorageService } from '../../platform/platform-storage.service';
import { ClientInstanceService } from './client-instance.service';

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
   * Vibrate only when the SSE payload targets this device's client instance id.
   */
  notifyPickupReady(kind: PickupReadyKind, options: PickupReadyNotifyOptions): void {
    if (!this.hapticsEnabled) return;

    if (!this.clientInstance.isPickupTarget(options.clientInstanceId)) return;

    const tableId = options.tableId?.trim();
    if (!tableId) return;

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${tableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) return;
    this.lastVibrateAtByTable.set(`${kind}:${tableId}`, now);

    void this.vibrate(PICKUP_VIBRATE_MS);
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
