import { TestBed } from '@angular/core/testing';
import { OfflineDbService } from './offline-db';
import { Currency, TableDTO } from '../models/restaurantTablesModel';
import { OrderDTO } from '../models/orderingModel';
import { SYNC_TABLE_A } from '../../testing/sse-sync-test-harness';

describe('OfflineDbService applySyncSnapshot (sync regression)', () => {
  let service: OfflineDbService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [OfflineDbService] });
    service = TestBed.inject(OfflineDbService);

    spyOn(service, 'saveTables').and.returnValue(Promise.resolve());
    spyOn(service, 'saveTablesStatus').and.returnValue(Promise.resolve());
    spyOn(service, 'saveOrderSnapshot').and.returnValue(Promise.resolve());
    spyOn(service, 'deleteCart').and.returnValue(Promise.resolve());
    spyOn(service, 'loadCartRecord').and.returnValue(Promise.resolve(null));
    spyOn(service, 'loadOrder').and.returnValue(Promise.resolve(null));
    spyOn(service as unknown as { hasPendingActionsForTable: (id: string) => Promise<boolean> }, 'hasPendingActionsForTable')
      .and.returnValue(Promise.resolve(false));
  });

  function openTableSnapshot(): TableDTO[] {
    return [{
      restaurantId: 'r1',
      tableId: SYNC_TABLE_A,
      tableName: 'A',
      isTableOpen: true,
      isWaiterCalled: false,
    }];
  }

  it('deletes local cart when server snapshot has no order and no local session', async () => {
    await service.applySyncSnapshot(openTableSnapshot());

    expect(service.deleteCart).toHaveBeenCalledWith(SYNC_TABLE_A);
  });

  it('deletes confirmed server cart when snapshot has no order and queue is empty', async () => {
    (service.loadCartRecord as jasmine.Spy).and.returnValue(Promise.resolve({
      tableId: SYNC_TABLE_A,
      orderId: '019f-server-order',
      items: [{ item: { menuItemId: 'm1', menuItemName: 'X', category: 'Main' }, quantity: 1 }],
    }));

    await service.applySyncSnapshot(openTableSnapshot());

    expect(service.deleteCart).toHaveBeenCalledWith(SYNC_TABLE_A);
  });

  it('merges occupied table from local order only when queue is pending', async () => {
    (service as unknown as { hasPendingActionsForTable: jasmine.Spy<(id: string) => Promise<boolean>> }).hasPendingActionsForTable
      .and.returnValue(Promise.resolve(true));
    (service.loadCartRecord as jasmine.Spy).and.returnValue(Promise.resolve({
      tableId: SYNC_TABLE_A,
      orderId: '019f-server-order',
      items: [{ item: { menuItemId: 'm1', menuItemName: 'X', category: 'Main' }, quantity: 1 }],
    }));
    (service.loadOrder as jasmine.Spy).and.returnValue(Promise.resolve({
      orderId: '019f-server-order',
      isOrderOpen: true,
      orderItems: [{ orderItemId: 'l1', menuItemId: 'm1', quantity: 1 }],
      createdOn: new Date().toISOString(),
      currency: Currency.RON,
      subTotal: { amount: 10, currency: Currency.RON },
    } as OrderDTO));

    await service.applySyncSnapshot(openTableSnapshot());

    expect(service.saveTables).toHaveBeenCalledWith(
      jasmine.arrayContaining([
        jasmine.objectContaining({ tableId: SYNC_TABLE_A, isTableOpen: false }),
      ]),
    );
  });
});
