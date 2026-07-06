/**
 * Kitchen station OrderUpdated diff — sync-baseline-pwa contract.
 */
import { KitchenComponent } from './kitchen.component';
import {
  createCartLine,
  createFoodMenuItem,
  invokeStationSse,
  setupKitchenComponent,
  SYNC_TABLE_A,
} from '../../../testing/sse-sync-test-harness';
import {
  fixtureOrderUpdatedAddNewFood,
  fixtureOrderUpdatedDeleteFood,
  fixtureOrderUpdatedQtyDecreaseFood,
  fixtureOrderUpdatedQtyIncreaseFood,
  LINE_PIZZA_1,
  ORDER_A,
} from '../../../testing/sse-fixtures/order-mutation.fixtures';

describe('KitchenComponent OrderUpdated SSE (sync regression)', () => {
  let component: KitchenComponent;
  let mocks: Awaited<ReturnType<typeof setupKitchenComponent>>['mocks'];

  beforeEach(async () => {
    ({ component, mocks } = await setupKitchenComponent());
  });

  it('shows new food item when order gains first kitchen line', async () => {
    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedAddNewFood(), 401);

    expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
    const order = component.ordersByTableId[SYNC_TABLE_A];
    expect(order?.items.length).toBe(1);
    expect(order?.items[0].quantity).toBe(1);
  });

  it('updates qty when same food item already in cart (1→2)', async () => {
    const pizza = createFoodMenuItem();
    await mocks.offlineDb.saveCart(SYNC_TABLE_A, [createCartLine(pizza, 1, LINE_PIZZA_1)], ORDER_A, true);
    (component as unknown as { lastCartSnapshotByTableId: Record<string, unknown[]> }).lastCartSnapshotByTableId = {
      [SYNC_TABLE_A]: [createCartLine(pizza, 1, LINE_PIZZA_1)],
    };

    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyIncreaseFood(), 402);

    expect(component.ordersByTableId[SYNC_TABLE_A]?.items[0].quantity).toBe(2);
  });

  it('updates qty when minus button reduces quantity (2→1)', async () => {
    const pizza = createFoodMenuItem();
    await mocks.offlineDb.saveCart(SYNC_TABLE_A, [createCartLine(pizza, 2, LINE_PIZZA_1)], ORDER_A, true);
    (component as unknown as { lastCartSnapshotByTableId: Record<string, unknown[]> }).lastCartSnapshotByTableId = {
      [SYNC_TABLE_A]: [createCartLine(pizza, 2, LINE_PIZZA_1)],
    };

    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyDecreaseFood(), 403);

    expect(component.ordersByTableId[SYNC_TABLE_A]?.items[0].quantity).toBe(1);
  });

  it('clears kitchen order when last food line removed (delete via x)', async () => {
    await mocks.offlineDb.saveCart(SYNC_TABLE_A, [], ORDER_A, true);
    (component as unknown as { lastCartSnapshotByTableId: Record<string, unknown[]> }).lastCartSnapshotByTableId = {
      [SYNC_TABLE_A]: [],
    };

    await invokeStationSse(component, 'OrderUpdated', fixtureOrderUpdatedDeleteFood(), 404);

    expect(component.ordersByTableId[SYNC_TABLE_A]).toBeUndefined();
  });
});
