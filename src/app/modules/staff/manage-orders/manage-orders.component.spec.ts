import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { WaiterCallState } from '../../../core/models/callWaiter/callWaiter';
import { ManageOrdersComponent } from './manage-orders.component';
import {
  TABLE_A,
  TABLE_B,
  TABLE_C,
  TEST_RESTAURANT_ID,
  createCartItem,
  createDefaultTables,
  createMenuItem,
  createTable,
  invokeSse,
  seedComponentTables,
  setRestaurantId,
  setupManageOrdersComponent,
} from './manage-orders-test-harness';

describe('ManageOrdersComponent', () => {
  describe('initialization', () => {
    it('should create', async () => {
      const { component } = await setupManageOrdersComponent();
      expect(component).toBeTruthy();
    });

    it('loads tables and menu on init', async () => {
      const { component, mocks } = await setupManageOrdersComponent();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mocks.tablesService.getAllWithFallback).toHaveBeenCalledWith(TEST_RESTAURANT_ID);
      expect(mocks.menuItemService.getAllWithFallback).toHaveBeenCalledWith(TEST_RESTAURANT_ID);
      expect(mocks.reservationService.list).toHaveBeenCalled();
      expect(component.tables.length).toBe(3);
      expect(component.menuItems.length).toBeGreaterThan(0);
      expect(mocks.offlineDb.loadTablesStatusMap).toHaveBeenCalled();
    });

    it('groups today bookings by table on init', async () => {
      const { component } = await setupManageOrdersComponent({
        reservations: [
          {
            reservationId: 'res-1',
            tableId: TABLE_A,
            tableLabel: 'Table A',
            customerName: 'Alice',
            phone: '+40123456789',
            partySize: 2,
            start: new Date().toISOString(),
            end: new Date(Date.now() + 3600000).toISOString(),
            status: 'Active',
          },
          {
            reservationId: 'res-2',
            tableId: TABLE_A,
            tableLabel: 'Table A',
            customerName: 'Bob',
            phone: '+40987654321',
            partySize: 4,
            start: new Date(Date.now() + 7200000).toISOString(),
            end: new Date(Date.now() + 10800000).toISOString(),
            status: 'Active',
          },
        ],
      });
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(component.bookingsForTable(TABLE_A).length).toBe(2);
      expect(component.bookingsForTable(TABLE_B)).toEqual([]);
    });

    it('restores currentTableId from localStorage on init', async () => {
      spyOn(localStorage, 'getItem').and.returnValue(TABLE_B);
      const { component } = await setupManageOrdersComponent();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(component.currentTableId).toBe(TABLE_B);
      expect(component.canvasVisible).toBeTrue();
    });
  });

  describe('table state helpers', () => {
    let component: ManageOrdersComponent;

    beforeEach(async () => {
      ({ component } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      seedComponentTables(component);
    });

    it('markTableAsClosed moves table to closedTables', () => {
      component.markTableAsClosed(TABLE_A);

      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeFalse();
      expect(component.closedTables.some(t => t.tableId === TABLE_A)).toBeTrue();
      expect(component.openTables.some(t => t.tableId === TABLE_A)).toBeFalse();
    });

    it('markTableAsOpen clears order and moves table to openTables', () => {
      component.tables = component.tables.map(t =>
        t.tableId === TABLE_C ? { ...t, isTableOpen: false, order: { orderId: 'ord-1' } as never } : t,
      );
      component.refreshTableLists();

      component.markTableAsOpen(TABLE_C);

      const table = component.tables.find(t => t.tableId === TABLE_C);
      expect(table?.isTableOpen).toBeTrue();
      expect(table?.order).toBeUndefined();
      expect(component.openTables.some(t => t.tableId === TABLE_C)).toBeTrue();
    });

    it('canMoveOrder returns true only when order is confirmed and targets exist', () => {
      component.currentTableId = TABLE_A;
      component.orderIsConfirmed = true;
      component.currentOrderId = 'real-order-1';
      component.tablesAvailable = { [TABLE_A]: false, [TABLE_B]: true, [TABLE_C]: false };

      expect(component.canMoveOrder()).toBeTrue();

      component.currentOrderId = 'local-draft';
      expect(component.canMoveOrder()).toBeFalse();

      component.currentOrderId = 'real-order-1';
      component.tablesAvailable[TABLE_B] = false;
      expect(component.canMoveOrder()).toBeFalse();
    });

    it('availableTablesForMove excludes current table and occupied tables', () => {
      component.currentTableId = TABLE_A;
      component.tablesAvailable = {
        [TABLE_A]: false,
        [TABLE_B]: true,
        [TABLE_C]: false,
      };

      const ids = component.availableTablesForMove.map(t => t.tableId);
      expect(ids).toEqual([TABLE_B]);
    });

    it('trackByTableId returns tableId', () => {
      const table = createTable({ tableId: TABLE_A });
      expect(component.trackByTableId(0, table)).toBe(TABLE_A);
    });
  });

  describe('cart and computed getters', () => {
    let component: ManageOrdersComponent;

    beforeEach(async () => {
      ({ component } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      component.currentTableId = TABLE_A;
      component.menuItems = [createMenuItem(), createMenuItem({ menuItemId: 'menu-2', category: 'Starters', menuItemName: 'Soup' })];
      component.categories = ['Main', 'Starters'];
      component.tableCarts[TABLE_A] = [
        createCartItem({ quantity: 2 }),
        createCartItem({ quantity: 1 }, { menuItemId: 'menu-2', menuItemPriceAmount: 10, category: 'Starters' }),
      ];
    });

    it('cartSubTotal and cartCurrency aggregate current table cart', () => {
      expect(component.cartSubTotal).toBe(60);
      expect(component.cartCurrency).toBe('RON');
    });

    it('filteredMenuItems filters by searchTerm', () => {
      component.searchTerm = 'pizza';
      expect(component.filteredMenuItems.length).toBe(1);
      expect(component.filteredMenuItems[0].menuItemName).toContain('Pizza');
    });

    it('nonEmptyCategories includes categories with menu items or cart lines', () => {
      expect(component.nonEmptyCategories).toContain('Main');
      expect(component.nonEmptyCategories).toContain('Starters');
    });

    it('displayMenuItemNameInCanvas truncates long unavailable item names', () => {
      const longName = 'Very Long Unavailable Item Name Here';
      const item = createMenuItem({ menuItemName: longName, isAvailable: false });
      const displayed = component.displayMenuItemNameInCanvas(item);
      expect(displayed.length).toBeLessThanOrEqual(18);
      expect(displayed.endsWith('…')).toBeTrue();
    });

    it('formatInitiatedBy maps stripe to translated label', () => {
      const transloco = TestBed.inject(TranslocoService);
      spyOn(transloco, 'translate').and.returnValue('Card payment');
      expect(component.formatInitiatedBy('stripe')).toBe('Card payment');
      expect(component.formatInitiatedBy('waiter')).toBe('waiter');
    });
  });

  describe('cart actions and offline queue', () => {
    let component: ManageOrdersComponent;
    let mocks: Awaited<ReturnType<typeof setupManageOrdersComponent>>['mocks'];

    beforeEach(async () => {
      ({ component, mocks } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      setRestaurantId(component);
      seedComponentTables(component);
      component.currentTableId = TABLE_A;
      component.menuItems = [createMenuItem()];
    });

    it('addCartItem shows toast when item is unavailable', async () => {
      const item = createMenuItem({ isAvailable: false });
      await component.addCartItem(item);

      expect(mocks.appToast.info).toHaveBeenCalled();
      expect(mocks.offlineDb.saveCart).not.toHaveBeenCalled();
    });

    it('addCartItem blocks when payment is locked for current order', async () => {
      component.orderIsConfirmed = true;
      component.currentOrderId = 'order-locked';
      component.paymentLockedByTable[TABLE_A] = { orderId: 'order-locked' };

      await component.addCartItem(createMenuItem());

      expect(mocks.offlineDb.saveCart).not.toHaveBeenCalled();
    });

    it('addCartItem saves cart offline and updates tableCarts', async () => {
      const item = createMenuItem();
      await component.addCartItem(item);

      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
      expect(component.tableCarts[TABLE_A]?.length).toBe(1);
      expect(component.tableCarts[TABLE_A]?.[0].quantity).toBe(1);
    });

    it('addCartItem enqueues offline action when order is confirmed', async () => {
      component.orderIsConfirmed = true;
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        items: [],
        orderId: 'real-order-1',
      });

      await component.addCartItem(createMenuItem());

      expect(mocks.offlineDb.addOfflineAction).toHaveBeenCalled();
      expect(mocks.queueProcessor.triggerProcessing).toHaveBeenCalled();
    });

    it('confirmOrder enqueues offline actions and marks table closed', async () => {
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });

      await component.confirmOrder();

      expect(component.orderIsConfirmed).toBeTrue();
      expect(component.currentOrderId).toMatch(/^local-/);
      expect(mocks.offlineDb.addOfflineAction).toHaveBeenCalledTimes(2);
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeFalse();
      expect(mocks.queueProcessor.triggerProcessing).toHaveBeenCalled();
    });

    it('removeItem updates cart and persists offline', async () => {
      const cartItem = createCartItem();
      mocks.offlineDb.loadCartRecord.and.resolveTo({ tableId: TABLE_A, items: [cartItem], orderId: null });
      mocks.offlineDb.loadCart.and.resolveTo([cartItem]);
      component.tableCarts[TABLE_A] = [cartItem];

      await component.removeItem(cartItem);

      expect(component.tableCarts[TABLE_A]).toEqual([]);
      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
    });

    it('decrementItem reduces quantity and persists offline', async () => {
      const cartItem = createCartItem({ quantity: 2 });
      mocks.offlineDb.loadCartRecord.and.resolveTo({ tableId: TABLE_A, items: [cartItem], orderId: null });
      mocks.offlineDb.loadCart.and.resolveTo([cartItem]);
      component.tableCarts[TABLE_A] = [cartItem];

      await component.decrementItem(cartItem);

      expect(component.tableCarts[TABLE_A][0].quantity).toBe(1);
      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
    });

    it('confirmResetCanvas clears cart and resets canvas state', async () => {
      component.tableCarts[TABLE_A] = [createCartItem()];
      component.currentOrderId = 'order-1';
      component.canvasVisible = true;

      await component.confirmResetCanvas();

      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(mocks.offlineDb.deleteActionsForOrder).toHaveBeenCalledWith('order-1');
      expect(component.canvasVisible).toBeFalse();
      expect(component.currentTableId).toBe('');
    });
  });

  describe('orderConfirmed$ subscription', () => {
    it('updates order state and closes table after queue confirmation', async () => {
      const { component, mocks } = await setupManageOrdersComponent();
      await new Promise(resolve => setTimeout(resolve, 0));

      component.currentTableId = TABLE_A;
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);
      mocks.queueProcessor.orderConfirmed$.next({ tableId: TABLE_A, orderId: 'server-order-1' });
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(component.currentOrderId).toBe('server-order-1');
      expect(component.orderIsConfirmed).toBeTrue();
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeFalse();
    });
  });

  describe('move order', () => {
    let component: ManageOrdersComponent;
    let mocks: Awaited<ReturnType<typeof setupManageOrdersComponent>>['mocks'];

    beforeEach(async () => {
      ({ component, mocks } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      setRestaurantId(component);
      seedComponentTables(component);
      component.currentTableId = TABLE_A;
      component.orderIsConfirmed = true;
      component.currentOrderId = 'real-order-1';
      component.tablesAvailable = { [TABLE_A]: false, [TABLE_B]: true, [TABLE_C]: false };
    });

    it('moveCartToSelectedTable returns early when canMoveOrder is false', async () => {
      component.orderIsConfirmed = false;
      component.selectedTargetTableId = TABLE_B;

      await component.moveCartToSelectedTable();

      expect(mocks.ordersService.moveOrder).not.toHaveBeenCalled();
    });

    it('moveCartToSelectedTable shows error when source cart is missing', async () => {
      component.selectedTargetTableId = TABLE_B;
      mocks.offlineDb.loadCartRecord.and.resolveTo(null);

      await component.moveCartToSelectedTable();

      expect(mocks.appToast.error).toHaveBeenCalledWith('No cart found for source table.');
      expect(component.selectedTargetTableId).toBeNull();
    });

    it('moveCartToSelectedTable shows error and syncs when target is occupied', async () => {
      component.selectedTargetTableId = TABLE_B;
      component.tablesAvailable = { [TABLE_A]: false, [TABLE_B]: true, [TABLE_C]: true };
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        items: [createCartItem()],
        orderId: 'real-order-1',
      });
      component.tablesAvailable[TABLE_B] = false;

      await component.moveCartToSelectedTable();

      expect(mocks.appToast.error).toHaveBeenCalledWith('Target table appears occupied. Refreshing status...');
      expect(mocks.tablesService.getAll).toHaveBeenCalled();
    });

    it('moveCartToSelectedTable moves cart and updates tables on success', async () => {
      component.selectedTargetTableId = TABLE_B;
      const cartItems = [createCartItem()];
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        items: cartItems,
        orderId: 'real-order-1',
      });
      mocks.offlineDb.loadAllCarts.and.resolveTo({ [TABLE_B]: cartItems });

      await component.moveCartToSelectedTable();

      expect(mocks.ordersService.moveOrder).toHaveBeenCalledWith(TEST_RESTAURANT_ID, TABLE_A, TABLE_B);
      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(TABLE_B, cartItems, 'real-order-id');
      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(component.currentTableId).toBe(TABLE_B);
      expect(component.tables.find(t => t.tableId === TABLE_B)?.isTableOpen).toBeFalse();
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeTrue();
      expect(mocks.appToast.success).toHaveBeenCalledWith('Order moved successfully.');
    });
  });

  describe('SSE handleSseEvent', () => {
    let component: ManageOrdersComponent;
    let mocks: Awaited<ReturnType<typeof setupManageOrdersComponent>>['mocks'];

    beforeEach(async () => {
      ({ component, mocks } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      seedComponentTables(component);
    });

    it('WaiterCall sets waiter id from PascalCase TableId', async () => {
      await invokeSse(component, 'WaiterCall', { TableId: TABLE_A });
      expect(component.waiterState[TABLE_A]).toBe(WaiterCallState.Active);
    });

    it('WaiterCall sets id from camelCase tableId', async () => {
      await invokeSse(component, 'WaiterCall', { tableId: TABLE_B });
      expect(component.waiterState[TABLE_B]).toBe(WaiterCallState.Active);
    });

    it('WaiterCallSnoozed clears active waiter highlight', async () => {
      component.waiterState[TABLE_A] = WaiterCallState.Active;
      await invokeSse(component, 'WaiterCallSnoozed', { TableId: TABLE_A });
      expect(component.waiterState[TABLE_A]).toBeUndefined();
    });

    it('KitchenWaiterCall sets kitchen pickup flag and triggers haptics', async () => {
      await invokeSse(component, 'KitchenWaiterCall', {
        TableId: TABLE_A,
        TableName: 'T1',
        ClientInstanceId: 'device-1',
      });
      expect(component.kitchenPickupRequested[TABLE_A]).toBeTrue();
      expect(mocks.appToast.info).toHaveBeenCalled();
      expect(mocks.deviceFeedback.notifyPickupReady).toHaveBeenCalledWith('kitchen', {
        tableId: TABLE_A,
        clientInstanceId: 'device-1',
      });
    });

    it('BarWaiterCall sets bar pickup flag and triggers haptics', async () => {
      await invokeSse(component, 'BarWaiterCall', {
        TableId: TABLE_B,
        TableName: 'T2',
        ClientInstanceId: 'device-2',
      });
      expect(component.barPickupRequested[TABLE_B]).toBeTrue();
      expect(mocks.deviceFeedback.notifyPickupReady).toHaveBeenCalledWith('bar', {
        tableId: TABLE_B,
        clientInstanceId: 'device-2',
      });
    });

    it('NewOrderPrivateEvent replaces local order id with server id', async () => {
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'local-draft';
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        items: [createCartItem()],
        orderId: 'local-draft',
      });

      await invokeSse(component, 'NewOrderPrivateEvent', { TableId: TABLE_A, OrderId: 'server-order-99' });

      expect(component.currentOrderId).toBe('server-order-99');
      expect(component.orderIsConfirmed).toBeTrue();
      expect(mocks.offlineDb.saveCart).toHaveBeenCalledWith(TABLE_A, jasmine.any(Array), 'server-order-99');
    });

    it('OrderUpdated skips merge when local draft is on current table', async () => {
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'local-draft';
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);

      await invokeSse(component, 'OrderUpdated', {
        TableId: TABLE_A,
        OrderId: 'server-order',
        Items: [],
        LastActionAt: new Date().toISOString(),
      });

      expect(mocks.offlineDb.saveCart).not.toHaveBeenCalled();
    });

    it('OrderUpdated updates cart and computed for other tables', async () => {
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'real-order-1';
      mocks.offlineDb.loadCart.and.resolveTo([createCartItem()]);

      await invokeSse(component, 'OrderUpdated', {
        TableId: TABLE_B,
        OrderId: 'order-b',
        Items: [{ MenuItemId: 'menu-item-1', OrderItemId: 'line-1', Quantity: 1, OrderItemPriceAmount: 25, OrderItemPriceCurrency: 'RON' }],
        LastActionAt: new Date().toISOString(),
        ItemCount: 1,
      }, 'waiter');

      expect(mocks.offlineDb.saveCart).toHaveBeenCalled();
      expect(component.tableComputed[TABLE_B]?.initiatedBy).toBe('waiter');
    });

    it('OrderUpdated with zero items frees the table instead of marking it occupied', async () => {
      component.tables = createDefaultTables().map(t =>
        t.tableId === TABLE_A ? { ...t, isTableOpen: false, order: { orderId: 'order-a', isOrderOpen: true } as never } : t,
      );
      component.refreshTableLists();
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'real-order-1';

      await invokeSse(component, 'OrderUpdated', {
        TableId: TABLE_A,
        OrderId: 'order-a',
        Items: [],
        ItemCount: 0,
        LastActionAt: new Date().toISOString(),
      });

      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(mocks.offlineDb.saveCart).not.toHaveBeenCalled();
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeTrue();
      expect(component.tableComputed[TABLE_A]).toBeUndefined();
    });

    it('removeItem on last confirmed line frees the table', async () => {
      const cartItem = createCartItem({ orderItemId: 'line-1' });
      component.currentTableId = TABLE_A;
      component.orderIsConfirmed = true;
      component.currentOrderId = 'real-order-1';
      component.tables = createDefaultTables().map(t =>
        t.tableId === TABLE_A ? { ...t, isTableOpen: false } : t,
      );
      component.refreshTableLists();
      component.tableCarts[TABLE_A] = [cartItem];
      mocks.offlineDb.loadCartRecord.and.resolveTo({
        tableId: TABLE_A,
        items: [cartItem],
        orderId: 'real-order-1',
      });
      mocks.offlineDb.loadCart.and.resolveTo([cartItem]);

      await component.removeItem(cartItem);

      expect(component.tableCarts[TABLE_A]).toEqual([]);
      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeTrue();
    });

    it('OrderPaymentLocked and OrderPaymentUnlocked manage paymentLockedByTable', async () => {
      await invokeSse(component, 'OrderPaymentLocked', { TableId: TABLE_A, OrderId: 'pay-order-1' });
      expect(component.paymentLockedByTable[TABLE_A]?.orderId).toBe('pay-order-1');
      expect(mocks.appToast.info).toHaveBeenCalled();

      await invokeSse(component, 'OrderPaymentUnlocked', { TableId: TABLE_A, OrderId: 'pay-order-1' });
      expect(component.paymentLockedByTable[TABLE_A]).toBeUndefined();
    });

    it('OrderClosedWithPayment frees table and resets canvas when current', async () => {
      component.currentTableId = TABLE_A;
      component.canvasVisible = true;
      component.tableCarts[TABLE_A] = [createCartItem()];

      await invokeSse(component, 'OrderClosedWithPayment', {
        TableId: TABLE_A,
        ClosedAt: new Date().toISOString(),
      }, 'stripe');

      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeTrue();
      expect(component.canvasVisible).toBeFalse();
      expect(component.tableComputed[TABLE_A]?.initiatedBy).toBe('stripe');
    });

    it('TablesStatusesUpdate keeps table occupied when local cart exists', async () => {
      component.tables = createDefaultTables();
      component.refreshTableLists();
      mocks.offlineDb.loadCartRecord.and.callFake(async (tableId: string) => {
        if (tableId === TABLE_A) {
          return { tableId, items: [createCartItem()], orderId: 'local-1' };
        }
        return null;
      });

      await invokeSse(component, 'TablesStatusesUpdate', [
        { tableId: TABLE_A, isTableOpen: true, orderId: undefined, subTotal: { amount: 0, currency: 'RON' } },
      ]);

      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeFalse();
      expect(mocks.ordersService.mapComputedDtoToComputed).not.toHaveBeenCalled();
    });

    it('TablesStatusesUpdate before initial load preserves persisted initiatedBy and skips save', async () => {
      mocks.ordersService.loadInitiatedByMap.and.returnValue({ [TABLE_B]: 'waiter' });
      mocks.ordersService.loadComputed.and.returnValue({});
      (component as unknown as { capturePersistedInitiatedBy: (o?: { replaceTableComputed?: boolean }) => void })
        .capturePersistedInitiatedBy();
      (component as unknown as { initialTablesLoaded: boolean }).initialTablesLoaded = false;
      mocks.ordersService.saveComputed.calls.reset();

      await invokeSse(component, 'TablesStatusesUpdate', [
        {
          tableId: TABLE_B,
          isTableOpen: false,
          orderId: 'order-b',
          subTotal: { amount: 50, currency: 'RON' },
          itemCount: 2,
          lastActionAt: new Date().toISOString(),
        },
      ]);

      expect(mocks.ordersService.saveComputed).not.toHaveBeenCalled();
      expect(component.tableComputed[TABLE_B]?.initiatedBy).toBe('waiter');
    });

    it('applyPersistedInitiatedByToComputed restores name after hydrate cleared it', async () => {
      mocks.ordersService.loadInitiatedByMap.and.returnValue({ [TABLE_C]: 'Maria Pop' });
      seedComponentTables(component);
      component.tableComputed[TABLE_C] = {
        lastActionAt: '',
        lastAddedItem: 'Pizza',
        total: 40,
        currency: 'RON',
        itemCount: 1,
        cssClass: 'table-css',
        initiatedBy: '',
      };
      (component as unknown as { capturePersistedInitiatedBy: () => void }).capturePersistedInitiatedBy();
      (component as unknown as { applyPersistedInitiatedByToComputed: () => void }).applyPersistedInitiatedByToComputed();
      expect(component.tableComputed[TABLE_C]?.initiatedBy).toBe('Maria Pop');
    });

    it('resolveInitiatedBy prefers order.lastInitiatedBy over stale tableComputed', () => {
      component.tables = [{
        ...createDefaultTables()[0],
        tableId: TABLE_A,
        isTableOpen: false,
        order: {
          orderId: 'order-a',
          isOrderOpen: true,
          lastInitiatedBy: 'Manager Name',
          createdOn: new Date().toISOString(),
          currency: 'RON' as import('../../../core/models/restaurantTablesModel').Currency,
        },
      }];
      component.tableComputed[TABLE_A] = {
        lastActionAt: '',
        lastAddedItem: 'Pizza',
        total: 40,
        currency: 'RON',
        itemCount: 1,
        cssClass: 'table-css',
        initiatedBy: 'Old Staff',
      };
      (component as unknown as { persistedInitiatedBy: Record<string, string> }).persistedInitiatedBy[TABLE_A] = 'Old Staff';

      const resolved = (component as unknown as { resolveInitiatedBy: (id: string) => string }).resolveInitiatedBy(TABLE_A);
      expect(resolved).toBe('Manager Name');
    });
  });

  describe('offline primary UI gates', () => {
    it('canBypassOfflineUiGates is false when offline and not primary device', async () => {
      const { component } = await setupManageOrdersComponent({
        isOnline: false,
        isOfflinePrimaryDevice: false,
      });
      expect(component.canBypassOfflineUiGates).toBeFalse();
    });

    it('canBypassOfflineUiGates is true when offline on primary device', async () => {
      const { component } = await setupManageOrdersComponent({
        isOnline: false,
        isOfflinePrimaryDevice: true,
      });
      expect(component.canBypassOfflineUiGates).toBeTrue();
    });

    it('isTableActionDisabled allows All tab offline when table has local session (partial offline)', async () => {
      const { component } = await setupManageOrdersComponent({
        isOnline: false,
        isOfflinePrimaryDevice: false,
        skipNgOnInit: true,
      });
      (component as unknown as { localSessionTableIds: Set<string> }).localSessionTableIds = new Set([TABLE_A]);
      const table = createTable({ tableId: TABLE_A, isTableOpen: false });

      expect(component.isTableActionDisabled(table, true)).toBeFalse();
    });

    it('isTableActionDisabled blocks All tab offline without local session (partial offline)', async () => {
      const { component } = await setupManageOrdersComponent({
        isOnline: false,
        isOfflinePrimaryDevice: false,
        skipNgOnInit: true,
      });
      const table = createTable({ tableId: TABLE_B, isTableOpen: false });

      expect(component.isTableActionDisabled(table, true)).toBeTrue();
    });

    it('confirmCloseOrder offline cleans up local table state (Q3)', async () => {
      const { component, mocks } = await setupManageOrdersComponent({
        isOnline: false,
        isOfflinePrimaryDevice: true,
        skipNgOnInit: true,
      });
      seedComponentTables(component, createDefaultTables());
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'local-order-1';
      component.orderIsConfirmed = true;
      component.tableCarts[TABLE_A] = [createCartItem()];
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });

      await component.confirmCloseOrder();

      expect(mocks.offlineDb.addOfflineAction).toHaveBeenCalled();
      expect(mocks.offlineDb.deleteCart).toHaveBeenCalledWith(TABLE_A);
      expect(mocks.offlineDb.upsertTableStatus).toHaveBeenCalledWith(TABLE_A, true);
      expect(component.tables.find(t => t.tableId === TABLE_A)?.isTableOpen).toBeTrue();
      expect(component.canvasVisible).toBeFalse();
    });
  });

  describe('keyboard and misc', () => {
    let component: ManageOrdersComponent;

    beforeEach(async () => {
      ({ component } = await setupManageOrdersComponent({ skipNgOnInit: true }));
      component.currentTableId = TABLE_A;
      component.currentOrderId = 'order-1';
    });

    it('onEscPressed clears searchTerm and filteredResults', () => {
      component.searchTerm = 'pizza';
      component.filteredResults = [createMenuItem()];

      component.onEscPressed();

      expect(component.searchTerm).toBe('');
      expect(component.filteredResults).toEqual([]);
    });

    it('isPaymentLockedForCurrentTable reflects lock for active order', () => {
      component.paymentLockedByTable[TABLE_A] = { orderId: 'order-1' };
      expect((component as unknown as { isPaymentLockedForCurrentTable: () => boolean }).isPaymentLockedForCurrentTable()).toBeTrue();

      component.paymentLockedByTable[TABLE_A] = { orderId: 'other-order' };
      expect((component as unknown as { isPaymentLockedForCurrentTable: () => boolean }).isPaymentLockedForCurrentTable()).toBeFalse();
    });
  });
});
