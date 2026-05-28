import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
import { MenuItem } from '../../../core/models/menu/menuItem';
import { SetMenuDTO } from '../../../core/models/menu/setMenu';
import { isFoodCategory } from '../../../core/models/menu/menu-item-category';
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
import { NotificationSoundService, type NotificationSoundKind } from '../../../core/services/sound/notification-sound.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

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
  opText?: string;
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
    TranslocoPipe,
  ]
})
export class KitchenComponent implements OnInit, OnDestroy {
  private readonly transloco = inject(TranslocoService);
  private destroy$ = new Subject<void>();
  private restaurantId = '';
  private hydrating = false;
  soundEnabled = false;
  soundMuted = false;
  private get debugSoundsEnabled(): boolean {
    try { return localStorage.getItem('debugSounds') === '1'; } catch { return false; }
  }
  private debugSound(...args: unknown[]): void {
    if (!this.debugSoundsEnabled) return;
    // eslint-disable-next-line no-console
    console.debug('[KitchenSound]', ...args);
  }

  tablesById: Record<string, TableDTO> = {};
  ordersByTableId: Record<string, KitchenOrder> = {}; // derived from Dexie carts
  private menuItemsById: Record<string, MenuItem | undefined> = {};
  private todaySetMenu: SetMenuDTO | null = null;

  private orderIdToTableId: Record<string, string> = {};
  private expandedTableIds = new Set<string>();

  private marksByTableId: Record<string, Record<string, ItemMark>> = {};
  private clearMarkTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private lastOpTextByTableId: Record<string, Record<string, string>> = {};
  private deletedShadowsByTableId: Record<string, Record<string, KitchenLineItem & { _until: number }>> = {};
  private readonly markMs = 90_000;
  private pendingSoundKind: NotificationSoundKind | null = null;
  private pendingSoundTimer: ReturnType<typeof setTimeout> | null = null;
  private seenServerOrderIds = new Set<string>();
  private lastToastAtByKey: Record<string, number> = {};
  private readonly recentSseSequences: number[] = [];
  private readonly recentSseSequenceSet = new Set<number>();
  private readonly maxRecentSseSequences = 300;
  private lastOrderUpdatedKeyByTableId: Record<string, string> = {};
  private lastCartSnapshotByTableId: Record<string, CartItem[]> = {};
  private toastOnce(key: string, ms: number, fn: () => void): void {
    const now = Date.now();
    if (now - (this.lastToastAtByKey[key] ?? 0) < ms) return;
    this.lastToastAtByKey[key] = now;
    fn();
  }

  private tableLabel(tableId: string): string {
    return this.tablesById[tableId]?.tableName ?? tableId;
  }

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
    private sounds: NotificationSoundService,
  ) {}

  ngOnInit(): void {
    this.sounds.armOnce();
    this.soundEnabled = this.sounds.isUnlocked;
    this.soundMuted = this.getSoundMuted();
    this.sse.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ev => this.handleSseEvent(ev));

    // UI should reflect Dexie: rebuild when carts mutate.
    this.offlineDB.cartsChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe(async ({ tableId }) => {
        if (this.hydrating) return;
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
        this.todaySetMenu = menu?.todaySetMenu ?? null;
        // #region agent log
        {
          const linkedId = this.todaySetMenu?.linkedMenuItemId ?? '';
          const linkedMi = linkedId ? this.menuItemsById[linkedId] : undefined;
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'kitchen.component.ts:ngOnInit',message:'menu loaded',data:{menuItemCount:(menu?.menuItems??[]).length,hasTodaySetMenu:!!this.todaySetMenu,linkedMenuItemId:linkedId,linkedInCache:!!linkedMi,linkedCacheName:linkedMi?.menuItemName??null,linkedCacheCategory:linkedMi?.category??null,setMenuTitle:this.todaySetMenu?.title??null},timestamp:Date.now(),hypothesisId:'A,C,D'})}).catch(()=>{});
        }
        // #endregion
        this.tablesById = Object.fromEntries(tables.map(t => [t.tableId, t]));
        await this.hydrateFromBackend(tables);
        await this.rebuildFromDexie();
      });
  }

  private getSoundMuted(): boolean {
    try { return localStorage.getItem('kitchenSoundMuted') === '1'; } catch { return false; }
  }

  private setSoundMuted(muted: boolean): void {
    this.soundMuted = muted;
    try { localStorage.setItem('kitchenSoundMuted', muted ? '1' : '0'); } catch { /* ignore */ }
  }

  async toggleSound(): Promise<void> {
    if (!this.soundEnabled) {
      // Must be called from a click: unlock audio, then unmute.
      const ok = await this.sounds.unlockFromGesture();
      this.soundEnabled = ok;
      if (!ok) return;
    }

    if (this.soundMuted) {
      this.setSoundMuted(false);
      this.sounds.play('uiToggle');
    } else {
      this.setSoundMuted(true);
    }
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
      this.toast.success(this.transloco.translate('kitchen.toastWaiterOk'));
    } catch (err) {
      console.error('[Kitchen] callWaiterForPickup failed', err);
      this.toast.error(this.transloco.translate('kitchen.toastWaiterFail'));
    }
  }

  private handleSseEvent({ EventType, Data, Sequence }: SseEvent<any>) {
    if (typeof Sequence === 'number' && Sequence > 0) {
      if (this.recentSseSequenceSet.has(Sequence)) return;
      this.recentSseSequenceSet.add(Sequence);
      this.recentSseSequences.push(Sequence);
      if (this.recentSseSequences.length > this.maxRecentSseSequences) {
        const old = this.recentSseSequences.shift();
        if (typeof old === 'number') this.recentSseSequenceSet.delete(old);
      }
    }
    switch (EventType) {
      case 'OrderUpdated': {
        const payload = Data as OrderUpdatedSSEPayload;
        void this.applyOrderUpdated(payload, Sequence);
        break;
      }
      case 'OrderItemAdded': {
        // Intentionally ignored: we compute UI changes + granular toasts from OrderUpdated diffs.
        break;
      }
      case 'OrderItemQuantityUpdated': {
        // Intentionally ignored: we compute qty++/qty-- from OrderUpdated diffs.
        break;
      }
      case 'OrderItemDeleted': {
        // Intentionally ignored: we compute delete from OrderUpdated diffs.
        break;
      }
      case 'OrderClosedWithPayment': {
        const tableId = Data?.TableId;
        if (tableId) {
          delete this.ordersByTableId[tableId];
          delete this.lastCartSnapshotByTableId[tableId];
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Initial load should reflect server truth. `getAllWithFallback` already calls
   * GET …/get-tables-status, which returns each table’s open order — no per-table
   * list-open-order calls (avoids N duplicate HTTP requests on kitchen/bar entry).
   */
  private async hydrateFromBackend(tables: TableDTO[]): Promise<void> {
    if (!this.restaurantId) return;

    this.hydrating = true;
    try {
      for (const t of tables) {
        const tableId = t.tableId;
        if (!tableId) continue;

        const order = t.order;
        if (!order?.orderId || order.orderId.startsWith('local-')) {
          await this.offlineDB.deleteCart(tableId);
          continue;
        }

        await this.offlineDB.saveOrderSnapshot(tableId, order);
      }
    } finally {
      this.hydrating = false;
    }
  }

  toggleExpanded(tableId: string) {
    if (this.expandedTableIds.has(tableId)) this.expandedTableIds.delete(tableId);
    else this.expandedTableIds.add(tableId);
  }

  isExpanded(tableId: string) {
    return this.expandedTableIds.has(tableId);
  }

  private filterFood(items: CartItem[]): CartItem[] {
    // For notifications/diff: if category is unknown (e.g. menu cache not ready yet),
    // still treat it as relevant so we don't miss toasts on some browsers.
    return items.filter(c => isFoodCategory(c.item.category) || !c.item.category || c.item.category === 'Unknown');
  }

  private async applyOrderUpdated(payload: OrderUpdatedSSEPayload, envelopeSequence?: number) {
    const tableId =
      (payload as unknown as { TableId?: string; tableId?: string }).TableId
      ?? (payload as unknown as { tableId?: string }).tableId
      ?? '';
    const orderId =
      (payload as unknown as { OrderId?: string; orderId?: string }).OrderId
      ?? (payload as unknown as { orderId?: string }).orderId
      ?? '';
    const lastActionAt =
      (payload as unknown as { LastActionAt?: string; lastActionAt?: string }).LastActionAt
      ?? (payload as unknown as { lastActionAt?: string }).lastActionAt
      ?? new Date().toISOString();

    if (!tableId || !orderId) return;

    const dedupeKey =
      typeof envelopeSequence === 'number' && envelopeSequence > 0
        ? `${orderId}:seq:${envelopeSequence}`
        : `${orderId}:${lastActionAt}`;
    if (this.lastOrderUpdatedKeyByTableId[tableId] === dedupeKey) {
      return;
    }
    this.lastOrderUpdatedKeyByTableId[tableId] = dedupeKey;

    this.orderIdToTableId[orderId] = tableId;

    const existing = this.lastCartSnapshotByTableId[tableId] ?? [];
    const prevFood = this.filterFood(existing);
    const rawItems = ((payload as unknown as { Items?: any[]; items?: any[] }).Items
      ?? (payload as unknown as { items?: any[] }).items
      ?? []) as any[];
    const nextCart: CartItem[] = rawItems.map(i => {
      const menuItemId: string = i?.MenuItemId ?? i?.menuItemId ?? '';
      const orderItemId: string | undefined = i?.OrderItemId ?? i?.orderItemId;
      const qty: number = i?.Quantity ?? i?.quantity ?? 0;
      const mi = this.menuItemsById[menuItemId];
      const rawCategory = (i?.Category ?? i?.category ?? 'Unknown');
      const linkedId = this.todaySetMenu?.linkedMenuItemId ?? '';
      const isLinkedSetMenu = !!linkedId && menuItemId === linkedId;
      // #region agent log
      if (isLinkedSetMenu || rawCategory === 16 || rawCategory === '16' || String(rawCategory).toLowerCase() === 'setmenu') {
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'kitchen.component.ts:applyOrderUpdated',message:'set menu line in OrderUpdated',data:{tableId,menuItemId,hasMi:!!mi,miName:mi?.menuItemName??null,rawCategory,isLinkedSetMenu,fallbackName:!mi},timestamp:Date.now(),hypothesisId:'A,B,D'})}).catch(()=>{});
      }
      // #endregion
      if (mi) {
        return { item: mi, quantity: qty, orderItemId };
      }
      return {
        item: {
          menuItemId,
          menuItemName: '—',
          menuItemDescription: '',
          menuItemPriceAmount: 0,
          menuItemPriceCurrency: (i?.OrderItemPriceCurrency ?? i?.orderItemPriceCurrency ?? 'EUR'),
          menuItemIconUrl: undefined,
          category: rawCategory,
        },
        quantity: qty,
        orderItemId,
      } satisfies CartItem;
    });

    const nextFood = this.filterFood(nextCart);
    const isServerOrderId = !!orderId && !orderId.startsWith('local-');
    const isNewOrder = isServerOrderId && !this.seenServerOrderIds.has(orderId) && nextFood.length > 0;
    if (isNewOrder && !this.hydrating && !document.hidden && !this.soundMuted) {
      this.sounds.play('newOrder');
    }
    if (isNewOrder) {
      const label = this.tableLabel(tableId);
      this.toastOnce(`newOrder:${orderId}`, 2000, () =>
        this.toast.sticky(
          this.transloco.translate('kitchen.toastNewOrderBody', { table: label }),
          this.transloco.translate('kitchen.toastNewOrderTitle'),
          'success'
        )
      );
    }
    if (isServerOrderId) this.seenServerOrderIds.add(orderId);
    this.diffAndMark(tableId, prevFood, nextFood, isNewOrder);

    // Update in-memory snapshot for next diffs/toasts (avoid Dexie race across tabs).
    this.lastCartSnapshotByTableId[tableId] = nextCart;

    await this.offlineDB.saveCart(tableId, nextCart, orderId, true);
    await this.rebuildFromDexie(tableId, lastActionAt);
  }

  private async applyOrderItemAdded(payload: AddOrderItemResponse) {
    const orderId = (payload as unknown as { orderId?: string; OrderId?: string }).orderId
      ?? (payload as unknown as { OrderId?: string }).OrderId
      ?? '';
    const orderItemId = (payload as unknown as { orderItemId?: string; OrderItemId?: string }).orderItemId
      ?? (payload as unknown as { OrderItemId?: string }).OrderItemId
      ?? '';
    const menuItemId = (payload as unknown as { menuItemId?: string; MenuItemId?: string }).menuItemId
      ?? (payload as unknown as { MenuItemId?: string }).MenuItemId
      ?? '';
    const quantity = (payload as unknown as { quantity?: number; Quantity?: number }).quantity
      ?? (payload as unknown as { Quantity?: number }).Quantity
      ?? 0;

    if (!orderId || !orderItemId || !menuItemId) return;

    let tableId = this.orderIdToTableId[orderId];
    if (!tableId) {
      try {
        const rec = await this.offlineDB.carts.where('orderId').equals(orderId).first();
        tableId = rec?.tableId ?? '';
        if (tableId) this.orderIdToTableId[orderId] = tableId;
      } catch {
        // ignore
      }
    }
    if (!tableId) return;

    const cart = await this.offlineDB.loadCart(tableId);
    const mi = this.menuItemsById[menuItemId];

    cart.push({
      item: mi ?? {
        menuItemId,
        menuItemName: '—',
        menuItemDescription: '',
        menuItemPriceAmount: 0,
        menuItemPriceCurrency: 'EUR',
        menuItemIconUrl: undefined,
        category: 'Unknown',
      },
      quantity,
      orderItemId,
    });

    if (isFoodCategory((mi?.category ?? 'Unknown'))) {
      this.setMark(tableId, orderItemId, 'added');
    }
    await this.offlineDB.saveCart(tableId, cart, orderId, true);
  }

  private async applyOrderItemQtyUpdated(payload: UpdateOrderItemQuantityResponse) {
    const orderId = (payload as unknown as { orderId?: string; OrderId?: string }).orderId
      ?? (payload as unknown as { OrderId?: string }).OrderId
      ?? '';
    const orderItemId = (payload as unknown as { orderItemId?: string; OrderItemId?: string }).orderItemId
      ?? (payload as unknown as { OrderItemId?: string }).OrderItemId
      ?? '';
    const quantity = (payload as unknown as { quantity?: number; Quantity?: number }).quantity
      ?? (payload as unknown as { Quantity?: number }).Quantity
      ?? 0;

    if (!orderId || !orderItemId) {
      this.debugSound('qtyUpdated: missing ids', { payload });
      return;
    }

    let tableId = this.orderIdToTableId[orderId];
    if (!tableId) {
      try {
        const rec = await this.offlineDB.carts.where('orderId').equals(orderId).first();
        tableId = rec?.tableId ?? '';
        if (tableId) this.orderIdToTableId[orderId] = tableId;
      } catch {
        // ignore
      }
    }
    if (!tableId) {
      this.debugSound('qtyUpdated: missing tableId (map+db)', { orderId, orderItemId, quantity });
      return;
    }
    const cart = await this.offlineDB.loadCart(tableId);
    const it = cart.find(c => c.orderItemId === orderItemId);
    if (!it) {
      this.debugSound('qtyUpdated: item not found in cart', {
        tableId,
        orderId,
        orderItemId,
        cartIds: cart.map(c => c.orderItemId),
      });
      return;
    }
    const prevQty = it.quantity;
    it.quantity = quantity;
    this.debugSound('qtyUpdated: mark+sound', { tableId, orderItemId, quantity });
    this.setMark(tableId, orderItemId, 'updated');
    const arrow = quantity > prevQty ? '↑' : '↓';
    this.setOpText(tableId, orderItemId, `${arrow} ${prevQty} → ${quantity}`);
    await this.offlineDB.saveCart(tableId, cart, orderId, true);
  }

  private async applyOrderItemDeleted(payload: DeleteOrderItemSSEPayload) {
    const orderId = (payload as unknown as { orderId?: string; OrderId?: string }).orderId
      ?? (payload as unknown as { OrderId?: string }).OrderId
      ?? '';
    const orderItemId = (payload as unknown as { orderItemId?: string; OrderItemId?: string }).orderItemId
      ?? (payload as unknown as { OrderItemId?: string }).OrderItemId
      ?? '';
    if (!orderId || !orderItemId) return;

    let tableId = this.orderIdToTableId[orderId];
    if (!tableId) {
      try {
        const rec = await this.offlineDB.carts.where('orderId').equals(orderId).first();
        tableId = rec?.tableId ?? '';
        if (tableId) this.orderIdToTableId[orderId] = tableId;
      } catch {
        // ignore
      }
    }
    if (!tableId) return;
    const cart = await this.offlineDB.loadCart(tableId);
    const idx = cart.findIndex(c => c.orderItemId === orderItemId);
    if (idx === -1) {
      // Item may already be removed by a preceding OrderUpdated snapshot.
      // Still play the delete beep to reflect the action.
      if (!this.hydrating && !document.hidden && !this.soundMuted) {
        this.sounds.play('itemDeleted');
      }
      return;
    }
    const wasFood = isFoodCategory(cart[idx].item.category);
    if (wasFood) {
      this.setMark(tableId, orderItemId, 'deleted');
      this.setOpText(tableId, orderItemId, '× removed');
      this.setDeletedShadow(tableId, orderItemId, {
        id: orderItemId,
        orderItemId,
        menuItemId: cart[idx].item.menuItemId,
        name: cart[idx].item.menuItemName,
        category: cart[idx].item.category,
        quantity: cart[idx].quantity,
        mark: { kind: 'deleted', until: Date.now() + this.markMs },
        opText: '× removed',
      });
    }
    cart.splice(idx, 1);
    await this.offlineDB.saveCart(tableId, cart, orderId, true);
  }

  private async rebuildFromDexie(tableId?: string, lastActionAt?: string) {
    if (!this.restaurantId) return;

    if (tableId) {
      const record = await this.offlineDB.loadCartRecord(tableId);
      if (!record?.orderId || record.orderId.startsWith('local-')) {
        delete this.ordersByTableId[tableId];
        delete this.lastCartSnapshotByTableId[tableId];
        return;
      }
      this.seenServerOrderIds.add(record.orderId);
      this.orderIdToTableId[record.orderId] = tableId;
      this.lastCartSnapshotByTableId[tableId] = record.items ?? [];

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
      this.seenServerOrderIds.add(record.orderId);
      this.orderIdToTableId[record.orderId] = tId;
      this.lastCartSnapshotByTableId[tId] = items ?? [];
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
    const live = cart
      .filter(c => isFoodCategory(c.item.category))
      .map(c => {
        const id = c.orderItemId ?? `menu:${c.item.menuItemId}`;
        const mark = this.marksByTableId[tableId]?.[id];
        const opText = this.lastOpTextByTableId[tableId]?.[id];
        const line = {
          id,
          orderItemId: c.orderItemId,
          menuItemId: c.item.menuItemId,
          name: c.item.menuItemName,
          category: c.item.category,
          quantity: c.quantity,
          mark: mark && mark.until > Date.now() ? mark : undefined,
          opText: opText ?? undefined,
        };
        // #region agent log
        const cat = String(c.item.category ?? '');
        if (line.name === '—' || cat === '16' || cat.toLowerCase() === 'setmenu') {
          fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'kitchen.component.ts:mapCartToKitchenItems',message:'kitchen line render',data:{tableId,menuItemId:line.menuItemId,name:line.name,category:line.category,linkedId:this.todaySetMenu?.linkedMenuItemId??null},timestamp:Date.now(),hypothesisId:'A,B,E'})}).catch(()=>{});
        }
        // #endregion
        return line;
      });

    const liveIds = new Set(live.map(x => x.id));
    const shadows = Object.values(this.deletedShadowsByTableId[tableId] ?? {})
      .filter(s => s._until > Date.now() && !liveIds.has(s.id))
      .map(({ _until, ...it }) => it);

    return [...live, ...shadows];
  }

  private setMark(tableId: string, itemId: string, kind: MarkKind, playSound: boolean = true) {
    const until = Date.now() + this.markMs;
    (this.marksByTableId[tableId] ??= {})[itemId] = { kind, until };
    if (playSound) this.queueSound(kind);
    const timerKey = `${tableId}:${itemId}`;
    if (this.clearMarkTimers[timerKey]) clearTimeout(this.clearMarkTimers[timerKey]);
    this.clearMarkTimers[timerKey] = setTimeout(() => {
      const m = this.marksByTableId[tableId]?.[itemId];
      if (m && m.until <= Date.now()) delete this.marksByTableId[tableId][itemId];
    }, this.markMs + 250);
  }

  private setOpText(tableId: string, itemId: string, text: string): void {
    (this.lastOpTextByTableId[tableId] ??= {})[itemId] = text;
  }

  private setDeletedShadow(tableId: string, itemId: string, item: KitchenLineItem): void {
    const until = Date.now() + this.markMs;
    (this.deletedShadowsByTableId[tableId] ??= {})[itemId] = { ...item, _until: until };
  }

  private queueSound(kind: MarkKind) {
    if (this.hydrating) return;
    if (document.hidden) return;
    if (this.soundMuted) return;

    this.debugSound('queueSound', { kind, hydrating: this.hydrating, hidden: document.hidden, muted: this.soundMuted });

    const mapped: NotificationSoundKind | null =
      kind === 'added' ? 'itemAdded'
        : kind === 'updated' ? 'qtyUpdated'
          : kind === 'deleted' ? 'itemDeleted'
            : null;
    if (!mapped) return;

    const priority: Record<NotificationSoundKind, number> = {
      newOrder: 4,
      itemDeleted: 3,
      itemAdded: 2,
      qtyUpdated: 1,
      uiToggle: 0
    };

    this.pendingSoundKind =
      (!this.pendingSoundKind || priority[mapped] >= priority[this.pendingSoundKind])
        ? mapped
        : this.pendingSoundKind;
    if (this.pendingSoundTimer) return;

    this.pendingSoundTimer = setTimeout(() => {
      this.pendingSoundTimer = null;
      const k = this.pendingSoundKind;
      this.pendingSoundKind = null;
      if (k) this.sounds.play(k);
    }, 0);
  }

  private diffAndMark(tableId: string, prev: CartItem[], next: CartItem[], isNewOrder: boolean) {
    const keyOf = (c: CartItem) => c.orderItemId ?? `menu:${c.item.menuItemId}`;
    const prevById = new Map(prev.map(p => [keyOf(p), p]));
    const nextById = new Map(next.map(n => [keyOf(n), n]));

    for (const [id, n] of nextById.entries()) {
      const p = prevById.get(id);
      if (!p) {
        this.setMark(tableId, id, 'added', !isNewOrder);
        if (!isNewOrder) {
          const label = this.tableLabel(tableId);
          this.toastOnce(`itemAdded:${tableId}:${id}`, 1500, () =>
            this.toast.sticky(
              this.transloco.translate('kitchen.toastNewItemBody', {
                name: n.item.menuItemName,
                qty: String(n.quantity),
                table: label
              }),
              this.transloco.translate('kitchen.toastNewItemTitle'),
              'info'
            )
          );
        }
      } else if (p.quantity !== n.quantity) {
        this.setMark(tableId, id, 'updated');
        const label = this.tableLabel(tableId);
        const prevQty = p.quantity;
        const nextQty = n.quantity;
        const arrow = nextQty > prevQty ? '↑' : '↓';
        this.setOpText(tableId, id, `${arrow} ${prevQty} → ${nextQty}`);
        if (nextQty > prevQty) {
          this.toastOnce(`qtyUp:${tableId}:${id}`, 1200, () =>
            this.toast.info(
              this.transloco.translate('kitchen.toastQtyUpBody', {
                name: n.item.menuItemName,
                prev: String(prevQty),
                next: String(nextQty),
                table: label
              }),
              this.transloco.translate('kitchen.toastQtyUpTitle'),
              8000
            )
          );
        } else {
          this.toastOnce(`qtyDown:${tableId}:${id}`, 1200, () =>
            this.toast.info(
              this.transloco.translate('kitchen.toastQtyDownBody', {
                name: n.item.menuItemName,
                prev: String(prevQty),
                next: String(nextQty),
                table: label
              }),
              this.transloco.translate('kitchen.toastQtyDownTitle'),
              8000
            )
          );
        }
      }
    }
    // Skip deletion detection when: new order (prev items belong to a different order)
    // or next is empty (order close — not a real item deletion).
    if (!isNewOrder && next.length > 0) {
      for (const id of prevById.keys()) {
        if (!nextById.has(id)) {
          this.setMark(tableId, id, 'deleted');
          const label = this.tableLabel(tableId);
          const prevItem = prevById.get(id);
          const name = prevItem?.item.menuItemName ?? 'Item';
          const qty = prevItem?.quantity ?? 0;
          this.setOpText(tableId, id, '× removed');
          if (prevItem) {
            this.setDeletedShadow(tableId, id, {
              id,
              orderItemId: prevItem.orderItemId,
              menuItemId: prevItem.item.menuItemId,
              name: prevItem.item.menuItemName,
              category: prevItem.item.category,
              quantity: prevItem.quantity,
              mark: { kind: 'deleted', until: Date.now() + this.markMs },
              opText: '× removed',
            });
          }
          this.toastOnce(`itemDeleted:${tableId}:${id}`, 1500, () =>
            this.toast.sticky(
              this.transloco.translate('kitchen.toastItemDeletedBody', { name, table: label }),
              this.transloco.translate('kitchen.toastItemDeletedTitle'),
              'warning'
            )
          );
        }
      }
    }
  }
}

