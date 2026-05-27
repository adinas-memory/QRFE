import { Injectable, inject } from '@angular/core';
import { DeviceFeedbackService, PickupReadyKind } from '../device/device-feedback.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';

export interface PickupSsePayload {
  tableId: string | null;
  clientInstanceId?: string | null;
}

/** Normalizes kitchen/bar pickup SSE and triggers device-targeted haptics. */
@Injectable({ providedIn: 'root' })
export class PickupNotificationService {
  readonly #platform = inject(RuntimePlatformService);

  constructor(private readonly deviceFeedback: DeviceFeedbackService) {}

  parsePickupPayload(data: unknown): PickupSsePayload {
    const tableId = this.field<string>(data, 'TableId', 'tableId') ?? null;
    const clientInstanceId =
      this.field<string>(data, 'ClientInstanceId', 'clientInstanceId') ?? null;
    return { tableId, clientInstanceId };
  }

  handlePickupSse(kind: PickupReadyKind, data: unknown): PickupSsePayload {
    const parsed = this.parsePickupPayload(data);
    if (!parsed.tableId) {
      return parsed;
    }

    // Native Android: alerts come from FCM push, not SSE haptics.
    if (this.#platform.isNative) {
      return parsed;
    }

    this.deviceFeedback.notifyPickupReady(kind, {
      tableId: parsed.tableId,
      clientInstanceId: parsed.clientInstanceId,
    });

    return parsed;
  }

  private field<T>(obj: unknown, pascal: string, camel: string): T | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const record = obj as Record<string, unknown>;
    const v = record[pascal] ?? record[camel];
    return v as T | undefined;
  }
}
