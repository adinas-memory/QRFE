/**
 * Bar station OrderUpdated diff — sync-baseline-pwa contract.
 * Primary adds drink → bar realtime (without manual refresh).
 */
import { BarComponent } from './bar.component';
import {
  invokeStationSse,
  setupBarComponent,
  SYNC_TABLE_A,
  createCartLine,
  createDrinkMenuItem,
} from '../../../testing/sse-sync-test-harness';
import {
  fixtureOrderUpdatedAddNewDrink,
  fixtureOrderUpdatedQtyDecreaseDrink,
  fixtureOrderUpdatedQtyIncreaseDrink,
  LINE_BEER_1,
  ORDER_A,
} from '../../../testing/sse-fixtures/order-mutation.fixtures';

describe('BarComponent OrderUpdated SSE (sync regression)', () => {
  let component: BarComponent;
  let mocks: Awaited<ReturnType<typeof setupBarComponent>>['mocks'];

  beforeEach(async () => {
    ({ component, mocks } = await setupBarComponent());
  });

  it('shows new drink order when primary adds first beverage (OrderUpdated)', async () => {
    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedAddNewDrink(), 301);

    expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
    const order = component.ordersByTableId[SYNC_TABLE_A];
    expect(order?.orderId).toBe(ORDER_A);
    expect(order?.items.length).toBe(1);
    expect(order?.items[0].quantity).toBe(1);
    expect(order?.items[0].orderItemId).toBe(LINE_BEER_1);
  });

  it('updates quantity when same drink is added again (qty 1→2)', async () => {
    const beer = createDrinkMenuItem();
    await mocks.offlineDb.saveCart(SYNC_TABLE_A, [createCartLine(beer, 1, LINE_BEER_1)], ORDER_A, true);
    (component as unknown as { lastCartSnapshotByTableId: Record<string, unknown[]> }).lastCartSnapshotByTableId = {
      [SYNC_TABLE_A]: [createCartLine(beer, 1, LINE_BEER_1)],
    };

    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyIncreaseDrink(), 302);

    const order = component.ordersByTableId[SYNC_TABLE_A];
    expect(order?.items[0].quantity).toBe(2);
  });

  it('updates quantity when drink qty decreases via minus button (2→1)', async () => {
    const beer = createDrinkMenuItem();
    await mocks.offlineDb.saveCart(SYNC_TABLE_A, [createCartLine(beer, 2, LINE_BEER_1)], ORDER_A, true);
    (component as unknown as { lastCartSnapshotByTableId: Record<string, unknown[]> }).lastCartSnapshotByTableId = {
      [SYNC_TABLE_A]: [createCartLine(beer, 2, LINE_BEER_1)],
    };

    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyDecreaseDrink(), 303);

    const order = component.ordersByTableId[SYNC_TABLE_A];
    expect(order?.items[0].quantity).toBe(1);
  });

  it('does not drop consecutive OrderUpdated with different sequences', async () => {
    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedAddNewDrink(), 304);
    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyIncreaseDrink(), 305);

    expect(component.ordersByTableId[SYNC_TABLE_A]?.items[0].quantity).toBe(2);
  });
});
