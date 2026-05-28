import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DeviceFeedbackService, PickupReadyKind } from '../device/device-feedback.service';
import { OrderSyncService } from '../order-service/order-sync.service';
import { PushRegistrationService } from '../push/push-registration.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { SseEvent } from '../../models/sseModel';
import { WaiterPushEventType } from '../push/push-notification-copy.service';

export interface PickupSsePayload {
  tableId: string | null;
  tableName?: string | null;
  clientInstanceId?: string | null;
}

/** Kitchen/bar pickup alerts via SSE (any staff route) and shared targeting rules. */
@Injectable({ providedIn: 'root' })
export class PickupNotificationService {
  readonly #platform = inject(RuntimePlatformService);
  readonly #deviceFeedback = inject(DeviceFeedbackService);
  readonly #pushRegistration = inject(PushRegistrationService);
  readonly #orderSync = inject(OrderSyncService);
  readonly #destroyRef = inject(DestroyRef);

  #globalAlertsStarted = false;

  /** Subscribe to pickup SSE app-wide (not only on manage-orders). */
  initGlobalAlerts(): void {
    if (this.#globalAlertsStarted) {
      return;
    }
    this.#globalAlertsStarted = true;

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

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'pickup-notification.service.ts:handlePickupSse',message:'SSE pickup',data:{kind,tableId:parsed.tableId,tableName:parsed.tableName,hidden:document.hidden,isNative:this.#platform.isNative},timestamp:Date.now(),hypothesisId:'H2,H3'})}).catch(()=>{});
    // #endregion

    void this.#pushRegistration.deliverPickupAlert({
      eventType,
      tableId: parsed.tableId,
      tableName: parsed.tableName,
      clientInstanceId: parsed.clientInstanceId,
      source: 'sse',
    });

    this.#deviceFeedback.notifyPickupReady(kind, {
      tableId: parsed.tableId,
      clientInstanceId: parsed.clientInstanceId,
    });

    return parsed;
  }

  private onSseEvent(ev: SseEvent<unknown>): void {
    switch (ev.EventType) {
      case 'KitchenWaiterCall':
        this.handlePickupSse('kitchen', ev.Data);
        break;
      case 'BarWaiterCall':
        this.handlePickupSse('bar', ev.Data);
        break;
      default:
        break;
    }
  }

  private field<T>(obj: unknown, pascal: string, camel: string): T | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const record = obj as Record<string, unknown>;
    const v = record[pascal] ?? record[camel];
    return v as T | undefined;
  }
}
