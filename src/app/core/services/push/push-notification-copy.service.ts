import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type WaiterPushEventType =
  | 'KitchenWaiterCall'
  | 'BarWaiterCall'
  | 'WaiterCall'
  | string;

@Injectable({ providedIn: 'root' })
export class PushNotificationCopyService {
  readonly #transloco = inject(TranslocoService);

  titleFor(eventType: WaiterPushEventType): string {
    switch (eventType) {
      case 'KitchenWaiterCall':
        return this.#transloco.translate('push.kitchenTitle');
      case 'BarWaiterCall':
        return this.#transloco.translate('push.barTitle');
      case 'WaiterCall':
        return this.#transloco.translate('push.tableTitle');
      default:
        return this.#transloco.translate('push.defaultTitle');
    }
  }

  bodyFor(eventType: WaiterPushEventType, tableName?: string | null): string {
    const table = (tableName ?? '').trim();
    if (eventType === 'WaiterCall') {
      if (table) {
        return this.#transloco.translate('push.guestWaiterCallTable', { table });
      }
      return this.#transloco.translate('push.guestWaiterCall');
    }
    if (eventType === 'KitchenWaiterCall' || eventType === 'BarWaiterCall') {
      if (table) {
        return this.#transloco.translate('push.pickupReadyTable', { table });
      }
      return this.#transloco.translate('push.pickupReady');
    }
    return this.#transloco.translate('push.defaultBody');
  }
}
