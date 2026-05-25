import { Injectable } from '@angular/core';
import { ClientInstanceService } from './client-instance.service';

const HAPTICS_ENABLED_KEY = 'hapticsEnabled';
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

  constructor(private readonly clientInstance: ClientInstanceService) {}

  get hapticsEnabled(): boolean {
    try {
      const stored = localStorage.getItem(HAPTICS_ENABLED_KEY);
      if (stored === '0' || stored === 'false') return false;
      return true;
    } catch {
      return true;
    }
  }

  setHapticsEnabled(enabled: boolean): void {
    try {
      localStorage.setItem(HAPTICS_ENABLED_KEY, enabled ? '1' : '0');
    } catch {
      // ignore
    }
  }

  /**
   * Vibrate only when the SSE payload targets this device's client instance id.
   */
  notifyPickupReady(kind: PickupReadyKind, options: PickupReadyNotifyOptions): void {
    if (!this.hapticsEnabled) return;

    const targetId = (options.clientInstanceId ?? '').trim();
    if (!targetId) return;

    const localId = this.clientInstance.getId();
    if (!localId || targetId !== localId) return;

    const tableId = options.tableId?.trim();
    if (!tableId) return;

    const now = Date.now();
    const last = this.lastVibrateAtByTable.get(`${kind}:${tableId}`) ?? 0;
    if (now - last < DEBOUNCE_MS) return;
    this.lastVibrateAtByTable.set(`${kind}:${tableId}`, now);

    this.vibrate(PICKUP_VIBRATE_MS);
  }

  /** Web: Vibration API; Capacitor Android will branch here later. */
  private vibrate(durationMs: number): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(durationMs);
      }
    } catch {
      // ignore — iOS Safari often has no vibrate support
    }
  }
}
