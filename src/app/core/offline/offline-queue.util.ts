import { OfflineAction } from './offline-db';

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
