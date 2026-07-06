/**
 * Cross-device inbound SSE — sync-baseline-pwa contract (QRFE 5d02e76 behaviour).
 * Matrix: secondary→primary manage-orders cart hydration.
 */
import { ManageOrdersComponent } from './manage-orders.component';
import {
  TABLE_A,
  TABLE_B,
  createCartItem,
  createMenuItem,
  invokeSse,
  seedComponentTables,
  setupManageOrdersComponent,
} from './manage-orders-test-harness';
import {
  fixtureNewOrderPublicEvent,
  fixtureOrderUpdatedSecondaryToPrimary,
  fixtureOrderUpdatedAddNewFood,
  fixtureOrderUpdatedQtyIncreaseFood,
  fixtureOrderUpdatedQtyDecreaseFood,
  fixtureOrderUpdatedDeleteFood,
  LINE_PIZZA_1,
  LINE_SALAD_1,
  MENU_PIZZA,
  MENU_SALAD,
  ORDER_A,
  ORDER_B,
  SYNC_TABLE_B,
} from '../../../testing/sse-fixtures/order-mutation.fixtures';

describe('ManageOrdersComponent SSE inbound (sync regression)', () => {
  let component: ManageOrdersComponent;
  let mocks: Awaited<ReturnType<typeof setupManageOrdersComponent>>['mocks'];

  beforeEach(async () => {
    ({ component, mocks } = await setupManageOrdersComponent({ skipNgOnInit: true }));
    seedComponentTables(component);
    (component as unknown as { initialTablesLoaded: boolean }).initialTablesLoaded = true;
    mocks.offlineDb.loadMenu.and.resolveTo({
      menuItems: [
        createMenuItem(),
        createMenuItem({ menuItemId: MENU_SALAD, menuItemName: 'Salad', category: 'Starters' }),
      ],
      categories: ['Main', 'Starters'],
    });
  });

  describe('secondary → primary (PWA inbound)', () => {
    it('OrderUpdated hydrates cart when primary has no local session on that table', async () => {
      mocks.offlineDb.loadCartRecord.and.resolveTo(null);
      mocks.offlineDb.loadCart.and.resolveTo([]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedSecondaryToPrimary(), 'staff2', 201);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(
        SYNC_TABLE_B,
        jasmine.arrayContaining([jasmine.objectContaining({ quantity: 1, orderItemId: LINE_SALAD_1 })]),
        ORDER_B,
      );
      const table = component.tables.find(t => t.tableId === SYNC_TABLE_B);
      expect(table?.isTableOpen).toBeFalse();
      expect(component.tableCarts[SYNC_TABLE_B]?.length).toBe(1);
    });

    it('OrderUpdated updates primary canvas table when primary is on a different table', async () => {
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'real-order-on-a';
      component.canvasVisible = true;
      mocks.offlineDb.loadCartRecord.and.resolveTo(null);
      mocks.offlineDb.loadCart.and.resolveTo([]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedSecondaryToPrimary(), 'staff2', 202);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
      expect(component.tableCarts[SYNC_TABLE_B]?.length).toBe(1);
    });

    it('does not block OrderUpdated on table B when local draft is on table A only', async () => {
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'local-draft';
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedSecondaryToPrimary(), 'staff2', 203);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
    });

    it('skips OrderUpdated merge only for local draft on the same table', async () => {
      component.currentTableId = SYNC_TABLE_B;
      component.currentOrderId = 'local-draft';
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedSecondaryToPrimary(), 'staff2', 204);

      expect(mocks.offlineDb.saveCart).not.toHaveBeenCalled();
    });
  });

  describe('primary → secondary (outbound contract via same handler)', () => {
    it('NewOrderPublicEvent marks table occupied without line items', async () => {
      await invokeSse(component, 'NewOrderPublicEvent', fixtureNewOrderPublicEvent(), 'staff1', 0);

      const table = component.tables.find(t => t.tableId === TABLE_A);
      expect(table?.isTableOpen).toBeFalse();
      expect(mocks.offlineDb.saveTables).toHaveBeenCalled();
    });

    it('NewOrderPrivateEvent marks table occupied on internal SSE path', async () => {
      await invokeSse(component, 'NewOrderPrivateEvent', {
        TableId: TABLE_A,
        OrderId: ORDER_A,
        IsOrderOpen: true,
      }, 'staff1', 42);

      const table = component.tables.find(t => t.tableId === TABLE_A);
      expect(table?.isTableOpen).toBeFalse();
      expect(table?.order?.orderId).toBe(ORDER_A);
      expect(mocks.offlineDb.saveTables).toHaveBeenCalled();
    });

    it('OrderUpdated qty increase fully hydrates when local cart is behind SSE', async () => {
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        orderId: 'order-a',
        items: [createCartItem({ quantity: 1, orderItemId: LINE_PIZZA_1 })],
      });
      mocks.offlineDb.loadCart.and.resolveTo([
        createCartItem({ quantity: 1, orderItemId: LINE_PIZZA_1 }),
      ]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyIncreaseFood(), 'staff1', 205);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(
        TABLE_A,
        jasmine.arrayContaining([jasmine.objectContaining({ quantity: 2 })]),
        jasmine.any(String),
      );
    });

    it('OrderUpdated qty decrease (−) hydrates cart when secondary lowers quantity', async () => {
      mocks.offlineDb.hasPendingQueueActionsForTable.and.resolveTo(false);
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        orderId: 'order-a',
        items: [createCartItem({ quantity: 2, orderItemId: LINE_PIZZA_1, item: createMenuItem({ menuItemId: MENU_PIZZA }) })],
      });
      mocks.offlineDb.loadCart.and.resolveTo([
        createCartItem({ quantity: 2, orderItemId: LINE_PIZZA_1 }),
      ]);

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedQtyDecreaseFood(), 'staff2', 206);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(
        TABLE_A,
        jasmine.arrayContaining([jasmine.objectContaining({ quantity: 1 })]),
        jasmine.any(String),
      );
      expect(component.tableCarts[TABLE_A]?.[0]?.quantity).toBe(1);
    });

    it('OrderUpdated partial delete (x) hydrates cart when one line removed cross-device', async () => {
      mocks.offlineDb.hasPendingQueueActionsForTable.and.resolveTo(false);
      const beer = createMenuItem({ menuItemId: 'menu-beer-001', menuItemName: 'Beer', category: 'beer' });
      mocks.offlineDb.loadMenu.and.resolveTo({
        menuItems: [createMenuItem({ menuItemId: MENU_PIZZA }), beer],
        categories: ['Main', 'beer'],
      });
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        orderId: 'order-a',
        items: [
          createCartItem({ quantity: 1, orderItemId: LINE_PIZZA_1, item: createMenuItem({ menuItemId: MENU_PIZZA }) }),
          createCartItem({ quantity: 1, orderItemId: 'line-beer-001', item: beer }),
        ],
      });

      const afterDelete: ReturnType<typeof fixtureOrderUpdatedQtyDecreaseFood> = {
        ...fixtureOrderUpdatedQtyDecreaseFood(),
        SubTotal: { Amount: 10, Currency: 'RON' },
        ItemCount: 1,
        Items: fixtureOrderUpdatedQtyDecreaseFood().Items,
      };

      await invokeSse(component, 'OrderUpdated', afterDelete, 'staff2', 207);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(
        TABLE_A,
        jasmine.arrayContaining([jasmine.objectContaining({ quantity: 1 })]),
        jasmine.any(String),
      );
      expect(component.tableCarts[TABLE_A]?.length).toBe(1);
    });

    it('OrderUpdated empty cart frees table when last item deleted cross-device', async () => {
      mocks.offlineDb.hasPendingQueueActionsForTable.and.resolveTo(false);
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        orderId: 'order-a',
        items: [createCartItem({ quantity: 1, orderItemId: LINE_PIZZA_1 })],
      });

      await invokeSse(component, 'OrderUpdated', fixtureOrderUpdatedDeleteFood(), 'staff2', 208);

      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(component.tableCarts[TABLE_A]).toEqual([]);
    });
  });
});
