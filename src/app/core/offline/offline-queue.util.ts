import { OfflineAction } from './offline-db';

export interface SyncOrderItem {
  menuItemId: string;
  quantity: number;
}

export function getOfflineActionOrder(type: string): number {
  switch (type) {
    case 'NEW_ORDER': return 1;
    case 'INIT_ORDER_ITEMS_FINAL': return 2;
    case 'ADD_ITEM':
    case 'UPDATE_QUANTITY':
    case 'DELETE_ITEM': return 3;
    case 'CLOSE_ORDER': return 4;
    default: return 99;
  }
}

/** Preserve chronological order; tie-break by action type within the same millisecond. */
export function sortOfflineQueueActions(actions: OfflineAction[]): OfflineAction[] {
  return [...actions].sort((a, b) => {
    const byTime = a.timestamp - b.timestamp;
    if (byTime !== 0) return byTime;
    return getOfflineActionOrder(a.type) - getOfflineActionOrder(b.type);
  });
}

/**
 * Builds line items for syncing an offline order to the server.
 * Cart is used only when it still belongs to this order; otherwise INIT payload + queue mutations.
 */
export function buildSyncOrderItemsFromPending(
  pending: OfflineAction[],
  tableId: string,
  localOrderId: string,
  realOrderId: string,
  cartItems: SyncOrderItem[],
): SyncOrderItem[] {
  const itemMap = new Map<string, number>();
  const matchesOrder = (a: OfflineAction) =>
    a.tableId === tableId && (a.orderId === localOrderId || a.orderId === realOrderId);

  for (const item of cartItems) {
    if (item.quantity > 0) {
      itemMap.set(item.menuItemId, item.quantity);
    }
  }

  if (itemMap.size === 0) {
    const init = pending.find(a => matchesOrder(a) && a.type === 'INIT_ORDER_ITEMS_FINAL');
    const initItems = (init?.payload?.items ?? []) as SyncOrderItem[];
    for (const item of initItems) {
      if (item.menuItemId && item.quantity > 0) {
        itemMap.set(item.menuItemId, item.quantity);
      }
    }
  }

  const mutations = sortOfflineQueueActions(
    pending.filter(
      a =>
        matchesOrder(a) &&
        (a.type === 'ADD_ITEM' || a.type === 'UPDATE_QUANTITY' || a.type === 'DELETE_ITEM'),
    ),
  );

  for (const a of mutations) {
    const menuItemId = a.payload?.menuItemId as string | undefined;
    if (!menuItemId) continue;

    switch (a.type) {
      case 'ADD_ITEM':
        itemMap.set(menuItemId, (itemMap.get(menuItemId) ?? 0) + (a.payload.quantity ?? 0));
        break;
      case 'UPDATE_QUANTITY':
        if ((a.payload.quantity ?? 0) <= 0) {
          itemMap.delete(menuItemId);
        } else {
          itemMap.set(menuItemId, a.payload.quantity);
        }
        break;
      case 'DELETE_ITEM':
        itemMap.delete(menuItemId);
        break;
    }
  }

  return Array.from(itemMap.entries()).map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}
