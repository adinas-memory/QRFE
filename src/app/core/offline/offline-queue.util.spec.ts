import { OfflineAction } from './offline-db';
import { sortOfflineQueueActions } from './offline-queue.util';

function action(
  type: OfflineAction['type'],
  timestamp: number,
  orderId: string,
): OfflineAction {
  return {
    restaurantId: 'r1',
    type,
    tableId: 't1',
    orderId,
    payload: {},
    timestamp,
    status: 'pending',
  };
}

describe('sortOfflineQueueActions', () => {
  it('keeps CLOSE_ORDER before a later NEW_ORDER on the same table', () => {
    const sorted = sortOfflineQueueActions([
      action('NEW_ORDER', 100, 'local-1'),
      action('INIT_ORDER_ITEMS_FINAL', 110, 'local-1'),
      action('CLOSE_ORDER', 200, 'local-1'),
      action('NEW_ORDER', 300, 'local-2'),
      action('INIT_ORDER_ITEMS_FINAL', 310, 'local-2'),
    ]);

    expect(sorted.map(a => a.type)).toEqual([
      'NEW_ORDER',
      'INIT_ORDER_ITEMS_FINAL',
      'CLOSE_ORDER',
      'NEW_ORDER',
      'INIT_ORDER_ITEMS_FINAL',
    ]);
  });

  it('does not move all NEW_ORDER actions ahead of CLOSE_ORDER by type alone', () => {
    const sorted = sortOfflineQueueActions([
      action('NEW_ORDER', 300, 'local-2'),
      action('CLOSE_ORDER', 200, 'local-1'),
      action('NEW_ORDER', 100, 'local-1'),
    ]);

    expect(sorted.map(a => `${a.type}:${a.orderId}`)).toEqual([
      'NEW_ORDER:local-1',
      'CLOSE_ORDER:local-1',
      'NEW_ORDER:local-2',
    ]);
  });
});
