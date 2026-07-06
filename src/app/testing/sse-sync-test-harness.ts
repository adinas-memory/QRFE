import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { OrderSyncService } from '../core/services/order-service/order-sync.service';
import { TablesService } from '../core/services/tables-service/tables.service';
import { MenuItemServiceService } from '../core/services/menu-item-service/menu-item-service.service';
import { OfflineDbService } from '../core/offline/offline-db';
import { AppToastService } from '../core/services/toast-service/toast-service.service';
import { NotificationSoundService } from '../core/services/sound/notification-sound.service';
import { BarService } from '../core/services/bar-service/bar.service';
import { KitchenService } from '../core/services/kitchen-service/kitchen.service';
import { SseEvent } from '../core/models/sseModel';
import { CartItem } from '../core/models/orderingModel';
import { MenuItem } from '../core/models/menu/menuItem';
import { TableDTO } from '../core/models/restaurantTablesModel';
import { BarComponent } from '../modules/staff/bar/bar.component';
import { KitchenComponent } from '../modules/staff/kitchen/kitchen.component';
import { COMMON_TEST_PROVIDERS } from './common-test-providers';
import {
  SYNC_TABLE_A,
  SYNC_TABLE_B,
  SYNC_TEST_RESTAURANT_ID,
  MENU_BEER,
  MENU_PIZZA,
  MENU_SALAD,
} from './sse-fixtures/order-mutation.fixtures';

export { SYNC_TABLE_A, SYNC_TABLE_B, SYNC_TEST_RESTAURANT_ID };

export function createDrinkMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    menuItemId: MENU_BEER,
    menuItemName: 'Beer',
    menuItemPriceAmount: 15,
    menuItemPriceCurrency: 'RON',
    category: 'beer',
    isAvailable: true,
    ...overrides,
  };
}

export function createFoodMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    menuItemId: MENU_PIZZA,
    menuItemName: 'Pizza',
    menuItemPriceAmount: 25,
    menuItemPriceCurrency: 'RON',
    category: 'Main',
    isAvailable: true,
    ...overrides,
  };
}

export function createStarterMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    menuItemId: MENU_SALAD,
    menuItemName: 'Salad',
    menuItemPriceAmount: 15,
    menuItemPriceCurrency: 'RON',
    category: 'Starters',
    isAvailable: true,
    ...overrides,
  };
}

export function createSyncTables(): TableDTO[] {
  return [
    {
      restaurantId: SYNC_TEST_RESTAURANT_ID,
      tableId: SYNC_TABLE_A,
      tableName: 'Table A',
      isTableOpen: true,
      isWaiterCalled: false,
    },
    {
      restaurantId: SYNC_TEST_RESTAURANT_ID,
      tableId: SYNC_TABLE_B,
      tableName: 'Table B',
      isTableOpen: true,
      isWaiterCalled: false,
    },
  ];
}

export function createCartLine(
  menuItem: MenuItem,
  quantity: number,
  orderItemId?: string,
): CartItem {
  return {
    item: menuItem,
    quantity,
    orderItemId,
  };
}

export interface StationTestMocks {
  sseEvents$: Subject<SseEvent<unknown>>;
  snapshotRefreshed$: Subject<{ restaurantId: string; activeGuestWaiterCalls: string[] }>;
  offlineDb: jasmine.SpyObj<OfflineDbService>;
  tablesService: jasmine.SpyObj<TablesService>;
  menuItemService: jasmine.SpyObj<MenuItemServiceService>;
  sounds: jasmine.SpyObj<NotificationSoundService>;
}

export function createStationMocks(menuItems: MenuItem[]): StationTestMocks {
  const sseEvents$ = new Subject<SseEvent<unknown>>();
  const snapshotRefreshed$ = new Subject<{ restaurantId: string; activeGuestWaiterCalls: string[] }>();
  const tables = createSyncTables();
  const cartStore: Record<string, { tableId: string; orderId?: string; items: CartItem[] }> = {};

  const offlineDb = jasmine.createSpyObj('OfflineDbService', [
    'loadCart',
    'loadCartRecord',
    'loadAllCarts',
    'saveCart',
    'deleteCart',
  ]);
  offlineDb.loadCart.and.callFake(async (tableId: string) => cartStore[tableId]?.items ?? []);
  offlineDb.loadCartRecord.and.callFake(async (tableId: string) => cartStore[tableId] ?? null);
  offlineDb.loadAllCarts.and.callFake(async () => {
    const out: Record<string, CartItem[]> = {};
    for (const [id, rec] of Object.entries(cartStore)) {
      out[id] = rec.items;
    }
    return out;
  });
  offlineDb.saveCart.and.callFake(async (tableId: string, items: CartItem[], orderId?: string) => {
    cartStore[tableId] = { tableId, items, orderId };
  });
  offlineDb.deleteCart.and.callFake(async (tableId: string) => {
    delete cartStore[tableId];
  });
  Object.defineProperty(offlineDb, 'cartsChanged$', { value: of({ tableId: SYNC_TABLE_A }) });

  return {
    sseEvents$,
    snapshotRefreshed$,
    offlineDb,
    tablesService: {
      getAllWithFallback: jasmine.createSpy('getAllWithFallback').and.resolveTo(tables),
    } as jasmine.SpyObj<TablesService>,
    menuItemService: {
      getAllWithFallback: jasmine.createSpy('getAllWithFallback').and.resolveTo({
        menuItems,
        categories: [...new Set(menuItems.map(m => m.category))],
        todaySetMenu: null,
      }),
    } as jasmine.SpyObj<MenuItemServiceService>,
    sounds: jasmine.createSpyObj('NotificationSoundService', ['armOnce', 'play', 'unlockFromGesture'], {
      isUnlocked: true,
    }),
  };
}

async function setupBarComponentInternal() {
  const mocks = createStationMocks([createDrinkMenuItem()]);
  const barApi = jasmine.createSpyObj('BarService', ['callWaiterForPickup', 'snoozePickupCall']);
  barApi.callWaiterForPickup.and.returnValue(of(undefined));

  await TestBed.configureTestingModule({
    imports: [BarComponent],
    providers: [
      ...COMMON_TEST_PROVIDERS,
      {
        provide: AuthService,
        useValue: {
          getUserContext: () => of({ id: '1', role: 'staff', restaurantId: SYNC_TEST_RESTAURANT_ID }),
        },
      },
      { provide: OrderSyncService, useValue: { events$: mocks.sseEvents$, snapshotRefreshed$: mocks.snapshotRefreshed$.asObservable(), listenToRestaurantEvents: () => of({}) } },
      { provide: TablesService, useValue: mocks.tablesService },
      { provide: MenuItemServiceService, useValue: mocks.menuItemService },
      { provide: OfflineDbService, useValue: mocks.offlineDb },
      { provide: AppToastService, useValue: jasmine.createSpyObj('AppToastService', ['success', 'error', 'info', 'sticky']) },
      { provide: NotificationSoundService, useValue: mocks.sounds },
      { provide: BarService, useValue: barApi },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(BarComponent);
  fixture.detectChanges();
  await new Promise(resolve => setTimeout(resolve, 0));
  return { fixture, component: fixture.componentInstance, mocks };
}

async function setupKitchenComponentInternal() {
  const mocks = createStationMocks([createFoodMenuItem()]);
  const kitchenApi = jasmine.createSpyObj('KitchenService', ['callWaiterForPickup', 'snoozePickupCall']);
  kitchenApi.callWaiterForPickup.and.returnValue(of(undefined));

  await TestBed.configureTestingModule({
    imports: [KitchenComponent],
    providers: [
      ...COMMON_TEST_PROVIDERS,
      {
        provide: AuthService,
        useValue: {
          getUserContext: () => of({ id: '1', role: 'staff', restaurantId: SYNC_TEST_RESTAURANT_ID }),
        },
      },
      { provide: OrderSyncService, useValue: { events$: mocks.sseEvents$, snapshotRefreshed$: mocks.snapshotRefreshed$.asObservable(), listenToRestaurantEvents: () => of({}) } },
      { provide: TablesService, useValue: mocks.tablesService },
      { provide: MenuItemServiceService, useValue: mocks.menuItemService },
      { provide: OfflineDbService, useValue: mocks.offlineDb },
      { provide: AppToastService, useValue: jasmine.createSpyObj('AppToastService', ['success', 'error', 'info', 'sticky']) },
      { provide: NotificationSoundService, useValue: mocks.sounds },
      { provide: KitchenService, useValue: kitchenApi },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(KitchenComponent);
  fixture.detectChanges();
  await new Promise(resolve => setTimeout(resolve, 0));
  return { fixture, component: fixture.componentInstance, mocks };
}

export async function setupBarComponent() {
  return setupBarComponentInternal();
}

export async function setupKitchenComponent() {
  return setupKitchenComponentInternal();
}

export async function invokeStationSse(
  component: BarComponent | KitchenComponent,
  eventType: string,
  data: unknown,
  sequence = 100,
): Promise<void> {
  await (component as unknown as { handleSseEvent: (ev: SseEvent<unknown>) => void }).handleSseEvent({
    EventType: eventType,
    RestaurantId: SYNC_TEST_RESTAURANT_ID,
    Data: data,
    InitiatedBy: 'waiter',
    Sequence: sequence,
  });
  await new Promise(resolve => setTimeout(resolve, 0));
}

/** Mirrors order-sync.service.ts watermark filter (regression contract). */
export function shouldDropSseByWatermark(sequence: number | undefined, watermarkSequence: number): boolean {
  return !!(sequence && sequence < watermarkSequence);
}
