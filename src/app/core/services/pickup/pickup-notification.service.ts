import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OrderSyncService } from '../order-service/order-sync.service';
import { DeviceFeedbackService } from '../device/device-feedback.service';
import { PushRegistrationService } from '../push/push-registration.service';
import { SseEvent } from '../../models/sseModel';
import { WaiterPushEventType } from '../push/push-notification-copy.service';
export interface PickupSsePayload {
  tableId: string | null;
  tableName?: string | null;
  clientInstanceId?: string | null;
}

export type PickupReadyKind = 'kitchen' | 'bar';

const PICKUP_SEQ_STORAGE_KEY = 'qrfe-pickup-seq';

/** Kitchen/bar pickup and guest waiter alerts via SSE (any staff route). */
@Injectable({ providedIn: 'root' })
export class PickupNotificationService {
  readonly #deviceFeedback = inject(DeviceFeedbackService);
  readonly #pushRegistration = inject(PushRegistrationService);
  readonly #orderSync = inject(OrderSyncService);
  readonly #destroyRef = inject(DestroyRef);

  #globalAlertsStarted = false;
  readonly #recentSseSequenceSet = new Set<number>();
  readonly #recentSseSequences: number[] = [];
  readonly #maxRecentSseSequences = 200;

  /** Subscribe to pickup SSE app-wide (not only on manage-orders). */
  initGlobalAlerts(): void {
    if (this.#globalAlertsStarted) {
      return;
    }
    this.#globalAlertsStarted = true;
    this.loadPersistedSequences();

    this.#orderSync.events$
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe((ev) => this.onSseEvent(ev));
  }

  parsePickupPayload(data: unknown): PickupSsePayload {
    const tableId = this.field<string>(data, 'TableId', 'tableId') ?? null;
    const tableName = this.field<string>(data, 'TableName', 'tableName') ?? null;
    const clientInstanceId =
      this.field<string>(data, 'ClientInstanceId', 'clientInstanceId') ?? null;
    return { tableId, tableName, clientInstanceId };
  }

  handlePickupSse(kind: PickupReadyKind, data: unknown): PickupSsePayload {
    const parsed = this.parsePickupPayload(data);
    if (!parsed.tableId) {
      return parsed;
    }

    const eventType: WaiterPushEventType =
      kind === 'kitchen' ? 'KitchenWaiterCall' : 'BarWaiterCall';

    // SSE reached this device — always alert locally (ClientInstanceId gates FCM only).
    this.#deviceFeedback.notifyPickupFromPush(kind, parsed.tableId);

    void this.#pushRegistration.deliverPickupAlert({
      eventType,
      tableId: parsed.tableId,
      tableName: parsed.tableName,
      clientInstanceId: parsed.clientInstanceId,
      source: 'sse',
    });

    return parsed;
  }

  handleGuestWaiterSse(data: unknown): PickupSsePayload {
    const parsed = this.parsePickupPayload(data);
    if (!parsed.tableId) {
      return parsed;
    }

    this.#deviceFeedback.notifyGuestWaiterCall(parsed.tableId);

    void this.#pushRegistration.deliverGuestWaiterAlert({
      tableId: parsed.tableId,
      tableName: parsed.tableName,
      source: 'sse',
    });

    return parsed;
  }

  private onSseEvent(ev: SseEvent<unknown>): void {
    if (!this.shouldProcessPickupEvent(ev.Sequence)) {
      return;
    }

    switch (ev.EventType) {
      case 'KitchenWaiterCall':
        this.handlePickupSse('kitchen', ev.Data);
        break;
      case 'BarWaiterCall':
        this.handlePickupSse('bar', ev.Data);
        break;
      case 'WaiterCall':
        this.handleGuestWaiterSse(ev.Data);
        break;
      default:
        break;
    }
  }

  private shouldProcessPickupEvent(sequence: number | undefined): boolean {
    if (typeof sequence !== 'number' || sequence <= 0) {
      return true;
    }
    if (this.#recentSseSequenceSet.has(sequence)) {
      return false;
    }
    this.#recentSseSequenceSet.add(sequence);
    this.#recentSseSequences.push(sequence);
    if (this.#recentSseSequences.length > this.#maxRecentSseSequences) {
      const old = this.#recentSseSequences.shift();
      if (typeof old === 'number') {
        this.#recentSseSequenceSet.delete(old);
      }
    }
    this.persistSequences();
    return true;
  }

  private loadPersistedSequences(): void {
    try {
      const raw = sessionStorage.getItem(PICKUP_SEQ_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const n of parsed) {
        if (typeof n !== 'number' || n <= 0 || this.#recentSseSequenceSet.has(n)) continue;
        this.#recentSseSequenceSet.add(n);
        this.#recentSseSequences.push(n);
      }
    } catch {
      // ignore
    }
  }

  private persistSequences(): void {
    try {
      const tail = this.#recentSseSequences.slice(-50);
      sessionStorage.setItem(PICKUP_SEQ_STORAGE_KEY, JSON.stringify(tail));
    } catch {
      // ignore
    }
  }

  private field<T>(obj: unknown, pascal: string, camel: string): T | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const record = obj as Record<string, unknown>;
    const v = record[pascal] ?? record[camel];
    return v as T | undefined;
  }
}
