import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Subject, filter, take, takeUntil, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { OrderSyncService } from '../../../core/services/order-service/order-sync.service';
import { SseEvent } from '../../../core/models/sseModel';
import {
  AddOrderItemResponse,
  CartItem,
  DeleteOrderItemSSEPayload,
  OrderUpdatedSSEPayload,
  UpdateOrderItemQuantityResponse
} from '../../../core/models/orderingModel';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { MenuItem, MenuItemCategory } from '../../../core/models/menu/menuItem';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { KitchenService } from '../../../core/services/kitchen-service/kitchen.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { OfflineDbService } from '../../../core/offline/offline-db';

type MarkKind = 'added' | 'updated' | 'deleted';
type ItemMark = { kind: MarkKind; until: number };

type KitchenLineItem = {
  id: string; // orderItemId (preferred) or synthetic key
  orderItemId?: string;
  menuItemId: string;
  name: string;
  category: string;
  quantity: number;
  mark?: ItemMark;
};

type KitchenOrder = {
  restaurantId: string;
  tableId: string;
  tableName: string;
  orderId: string;
  lastActionAt: string;
  items: KitchenLineItem[];
};

@Component({
  selector: 'app-kitchen',
  standalone: true,
  templateUrl: './kitchen.component.html',
  styleUrls: ['./kitchen.component.scss'],
  imports: [
    RowComponent,
    ColComponent,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    NgFor,
    NgIf,
    NgClass,
    DatePipe,
  ]
})
export class KitchenComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private restaurantId = '';

  tablesById: Record<string, TableDTO> = {};
  ordersByTableId: Record<string, KitchenOrder> = {}; // derived from Dexie carts
  private menuItemsById: Record<string, MenuItem | undefined> = {};

  private orderIdToTableId: Record<string, string> = {};
  private expandedTableIds = new Set<string>();

  private marksByTableId: Record<string, Record<string, ItemMark>> = {};
  private clearMarkTimers: Record<string, any> = {};
  private readonly markMs = 90_000;

  get orders(): KitchenOrder[] {
    return Object.values(this.ordersByTableId)
      .sort((a, b) => (b.lastActionAt ?? '').localeCompare(a.lastActionAt ?? ''));
  }

  constructor(
    private auth: AuthService,
    private tablesService: TablesService,
    private menuItemService: MenuItemServiceService,
    private sse: OrderSyncService,
    private kitchenApi: KitchenService,
    private toast: AppToastService,
    private offlineDB: OfflineDbService,
  ) {}

  ngOnInit(): void {
    this.sse.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ev => this.handleSseEvent(ev));

    // UI should reflect Dexie: rebuild when carts mutate.
    this.offlineDB.cartsChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ tableId }) => {
        await this.rebuildFromDexie(tableId);
      });

    this.auth.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user?.restaurantId),
        take(1)
      )
      .subscribe(async user => {
        this.restaurantId = user.restaurantId!;
        // Ensure SSE is started in THIS tab as well (reliable even if app init was hidden).
        this.sse.listenToRestaurantEvents(this.restaurantId);
        const [tables, menu] = await Promise.all([
          this.tablesService.getAllWithFallback(this.restaurantId),
          this.menuItemService.getAllWithFallback(this.restaurantId),
        ]);

        this.menuItemsById = Object.fromEntries(
          (menu?.menuItems ?? []).map(mi => [mi.menuItemId, mi])
        );
        this.tablesById = Object.fromEntries(tables.map(t => [t.tableId, t]));
        await this.rebuildFromDexie();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    Object.values(this.clearMarkTimers).forEach(t => clearTimeout(t));
  }

  async callWaiterForPickup(tableId: string): Promise<void> {
    if (!this.restaurantId) return;
    try {
      await firstValueFrom(this.kitchenApi.callWaiterForPickup(this.restaurantId, tableId));
      this.toast.success('Waiter called for pickup.');
    } catch (err) {
      console.error('[Kitchen] callWaiterForPickup failed', err);
      this.toast.error('Failed to call waiter.');
    }
  }

  private handleSseEvent({ EventType, Data }: SseEvent<any>) {
    switch (EventType) {
      case 'OrderUpdated': {
        const payload = Data as OrderUpdatedSSEPayload;
        void this.applyOrderUpdated(payload);
        break;
      }
      case 'OrderItemAdded': {
        const payload = Data as AddOrderItemResponse;
        void this.applyOrderItemAdded(payload);
        break;
      }
      case 'OrderItemQuantityUpdated': {
        const payload = Data as UpdateOrderItemQuantityResponse;
        void this.applyOrderItemQtyUpdated(payload);
        break;
      }
      case 'OrderItemDeleted': {
        const payload = Data as DeleteOrderItemSSEPayload;
        void this.applyOrderItemDeleted(payload);
        break;
      }
      case 'OrderClosedWithPayment': {
        const tableId = Data?.TableId;
        if (tableId) delete this.ordersByTableId[tableId];
        break;
      }
      default:
        break;
    }
  }

  toggleExpanded(tableId: string) {
    if (this.expandedTableIds.has(tableId)) this.expandedTableIds.delete(tableId);
    else this.expandedTableIds.add(tableId);
  }

  isExpanded(tableId: string) {
    return this.expandedTableIds.has(tableId);
  }

  private async applyOrderUpdated(payload: OrderUpdatedSSEPayload) {
    const tableId = payload.TableId;
    this.orderIdToTableId[payload.OrderId] = tableId;

    const existing = await this.offlineDB.loadCart(tableId);
    const nextCart: CartItem[] = (payload.Items ?? []).map(i => {
      const mi = this.menuItemsById[i.MenuItemId];
      if (mi) {
        return { item: mi, quantity: i.Quantity, orderItemId: i.OrderItemId };
      }
      return {
        item: {
          menuItemId: i.MenuItemId,
          menuItemName: '—',
          menuItemDescription: '',
          menuItemPriceAmount: 0,
          menuItemPriceCurrency: (i as any).OrderItemPriceCurrency ?? 'EUR',
          menuItemIconUrl: undefined,
          category: (i as any).Category ?? 'Unknown',
        },
        quantity: i.Quantity,
        orderItemId: i.OrderItemId,
      } satisfies CartItem;
    });

    this.diffAndMark(tableId, existing, nextCart);
    await this.offlineDB.saveCart(tableId, nextCart, payload.OrderId, true);
    await this.rebuildFromDexie(tableId, payload.LastActionAt);
  }

  private async applyOrderItemAdded(payload: AddOrderItemResponse) {
    const tableId = this.orderIdToTableId[payload.orderId];
    if (!tableId) return;

    const cart = await this.offlineDB.loadCart(tableId);
    const mi = this.menuItemsById[payload.menuItemId];

    cart.push({
      item: mi ?? {
        menuItemId: payload.menuItemId,
        menuItemName: '—',
        menuItemDescription: '',
        menuItemPriceAmount: 0,
        menuItemPriceCurrency: 'EUR',
        menuItemIconUrl: undefined,
        category: 'Unknown',
      },
      quantity: payload.quantity,
      orderItemId: payload.orderItemId,
    });

    this.setMark(tableId, payload.orderItemId, 'added');
    await this.offlineDB.saveCart(tableId, cart, payload.orderId, true);
  }

  private async applyOrderItemQtyUpdated(payload: UpdateOrderItemQuantityResponse) {
    const tableId = this.orderIdToTableId[payload.orderId];
    if (!tableId) return;
    const cart = await this.offlineDB.loadCart(tableId);
    const it = cart.find(c => c.orderItemId === payload.orderItemId);
    if (!it) return;
    it.quantity = payload.quantity;
    this.setMark(tableId, payload.orderItemId, 'updated');
    await this.offlineDB.saveCart(tableId, cart, payload.orderId, true);
  }

  private async applyOrderItemDeleted(payload: DeleteOrderItemSSEPayload) {
    const tableId = this.orderIdToTableId[payload.orderId];
    if (!tableId) return;
    const cart = await this.offlineDB.loadCart(tableId);
    const idx = cart.findIndex(c => c.orderItemId === payload.orderItemId);
    if (idx === -1) return;
    this.setMark(tableId, payload.orderItemId, 'deleted');
    cart.splice(idx, 1);
    await this.offlineDB.saveCart(tableId, cart, payload.orderId, true);
  }

  private async rebuildFromDexie(tableId?: string, lastActionAt?: string) {
    if (!this.restaurantId) return;

    if (tableId) {
      const record = await this.offlineDB.loadCartRecord(tableId);
      if (!record?.orderId || record.orderId.startsWith('local-')) {
        delete this.ordersByTableId[tableId];
        return;
      }
      this.orderIdToTableId[record.orderId] = tableId;

      const mapped = this.mapCartToKitchenItems(tableId, record.items);
      if (!mapped.length) {
        delete this.ordersByTableId[tableId];
        return;
      }

      this.ordersByTableId[tableId] = {
        restaurantId: this.restaurantId,
        tableId,
        tableName: this.tablesById[tableId]?.tableName ?? '—',
        orderId: record.orderId,
        lastActionAt: lastActionAt ?? new Date().toISOString(),
        items: mapped
      };
      return;
    }

    const carts = await this.offlineDB.loadAllCarts();
    for (const [tId, items] of Object.entries(carts)) {
      const record = await this.offlineDB.loadCartRecord(tId);
      if (!record?.orderId || record.orderId.startsWith('local-')) continue;
      this.orderIdToTableId[record.orderId] = tId;
      const mapped = this.mapCartToKitchenItems(tId, items);
      if (!mapped.length) continue;
      this.ordersByTableId[tId] = {
        restaurantId: this.restaurantId,
        tableId: tId,
        tableName: this.tablesById[tId]?.tableName ?? '—',
        orderId: record.orderId,
        lastActionAt: new Date().toISOString(),
        items: mapped
      };
    }
  }

  private mapCartToKitchenItems(tableId: string, cart: CartItem[]): KitchenLineItem[] {
    return cart
      .filter(c => this.isFoodCategory(c.item.category))
      .map(c => {
        const id = c.orderItemId ?? `menu:${c.item.menuItemId}`;
        const mark = this.marksByTableId[tableId]?.[id];
        return {
          id,
          orderItemId: c.orderItemId,
          menuItemId: c.item.menuItemId,
          name: c.item.menuItemName,
          category: c.item.category,
          quantity: c.quantity,
          mark: mark && mark.until > Date.now() ? mark : undefined
        };
      });
  }

  private isFoodCategory(category: string | undefined | null): boolean {
    if (!category) return false;
    const drinks = new Set<string>([
      MenuItemCategory.RedWine,
      MenuItemCategory.WhiteWine,
      MenuItemCategory.RoseWine,
      MenuItemCategory.Beer,
      MenuItemCategory.Beverage
    ]);
    return !drinks.has(category);
  }

  private setMark(tableId: string, itemId: string, kind: MarkKind) {
    const until = Date.now() + this.markMs;
    (this.marksByTableId[tableId] ??= {})[itemId] = { kind, until };
    const timerKey = `${tableId}:${itemId}`;
    if (this.clearMarkTimers[timerKey]) clearTimeout(this.clearMarkTimers[timerKey]);
    this.clearMarkTimers[timerKey] = setTimeout(() => {
      const m = this.marksByTableId[tableId]?.[itemId];
      if (m && m.until <= Date.now()) delete this.marksByTableId[tableId][itemId];
    }, this.markMs + 250);
  }

  private diffAndMark(tableId: string, prev: CartItem[], next: CartItem[]) {
    const keyOf = (c: CartItem) => c.orderItemId ?? `menu:${c.item.menuItemId}`;
    const prevById = new Map(prev.map(p => [keyOf(p), p]));
    const nextById = new Map(next.map(n => [keyOf(n), n]));

    for (const [id, n] of nextById.entries()) {
      const p = prevById.get(id);
      if (!p) this.setMark(tableId, id, 'added');
      else if (p.quantity !== n.quantity) this.setMark(tableId, id, 'updated');
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) this.setMark(tableId, id, 'deleted');
    }
  }
}

