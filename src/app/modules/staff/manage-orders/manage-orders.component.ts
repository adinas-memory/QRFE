// ─── IMPORTS ──────────────────────────────────────────────────────────────────
import { FormsModule } from '@angular/forms';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import Fuse from 'fuse.js';
import { IconDirective } from '@coreui/icons-angular';
import {
  BadgeComponent, ButtonCloseDirective, ButtonDirective, CardBodyComponent, CardComponent,
  CardFooterComponent, CardGroupComponent, CardHeaderComponent, CardImgDirective, CardTextDirective,
  CardTitleDirective, ColComponent, ColDirective, DropdownComponent, DropdownItemDirective,
  DropdownMenuDirective, DropdownToggleDirective, ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, ModalToggleDirective,
  NavbarComponent, NavbarNavComponent, NavbarTogglerDirective, NavComponent, NavItemComponent,
  NavLinkDirective, OffcanvasBodyComponent, OffcanvasComponent, OffcanvasHeaderComponent,
  OffcanvasTitleDirective, OffcanvasToggleDirective, RowComponent, TableDirective, Tabs2Module,
  TemplateIdDirective, WidgetStatAComponent, WidgetStatFComponent
} from '@coreui/angular';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { filter, Subject, take, takeUntil, debounceTime, forkJoin, from, firstValueFrom } from 'rxjs';
import { NgFor, NgIf, NgStyle, CurrencyPipe, DecimalPipe, JsonPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { cilBellExclamation } from '@coreui/icons';
import { UserContextModel } from '../../../core/models/userContextModel';
import { WaiterCallState } from '../../../core/models/callWaiter/callWaiter';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { OrdersService } from '../../../core/services/order-service/orders.service';
import {
  CartItem,
  TableCart,
  OrderUpdatedSSEPayload,
  TableComputedDTO,
  OrderDTO
} from '../../../core/models/orderingModel';
import { OrderSyncService } from '../../../core/services/order-service/order-sync.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { OfflineDbService } from '../../../core/offline/offline-db';
import { OfflineQueueProcessor } from '../../../core/offline/offline-queue-processor.service';
import { SseEvent } from '../../../core/models/sseModel';
import { OnlineStateService } from '../../../core/offline/online-state-service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { KitchenService } from '../../../core/services/kitchen-service/kitchen.service';
import { BarService } from '../../../core/services/bar-service/bar.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-manage-orders',
  imports: [
    RowComponent, Tabs2Module, FormsModule,
    ColComponent, NgFor, NgIf, TableDirective,
    CardBodyComponent, CurrencyPipe, DecimalPipe, JsonPipe,
    CardComponent, CardGroupComponent, CardHeaderComponent,
    CardFooterComponent, ButtonDirective,
    CardImgDirective, BadgeComponent, ButtonCloseDirective,
    CardTextDirective, CardTitleDirective, ColComponent,
    ColDirective, NgStyle, IconDirective, RouterLink,
    OffcanvasBodyComponent, OffcanvasComponent, OffcanvasHeaderComponent,
    OffcanvasTitleDirective, OffcanvasToggleDirective,
    NavComponent, DropdownComponent, DropdownItemDirective,
    DropdownMenuDirective, DropdownToggleDirective,
    NavLinkDirective, NgClass,
    TranslocoPipe,
    ModalComponent,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalTitleDirective,
  ],
  styleUrls: ['./manage-orders.component.scss'],
  standalone: true,
  templateUrl: './manage-orders.component.html'
})
export class ManageOrdersComponent implements OnInit, OnDestroy {
  icons = { cilBellExclamation };
  private destroy$ = new Subject<void>();
  private readonly recentSseSequences: number[] = [];
  private readonly recentSseSequenceSet = new Set<number>();
  private readonly maxRecentSseSequences = 300;
  private restaurantId = '';

  waiterState: Record<string, WaiterCallState> = {};
  WaiterCallState = WaiterCallState;
  kitchenPickupRequested: Record<string, boolean> = {};
  private kitchenPickupTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  barPickupRequested: Record<string, boolean> = {};
  private barPickupTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  modalVisible = false;
  categories: string[] = [];
  menuItems: MenuItem[] = [];
  forceRefreshAfterUpdate = Date.now();
  tableName: string = '';
  canvasVisible = false;
  selectedCategory: string | null = null;
  tableCarts: TableCart = {};
  currentTableId!: string;
  seatId: string | null = null;
  tables: TableDTO[] = [];
  openTables: TableDTO[] = [];
  closedTables: TableDTO[] = [];
  searchTerm: string = '';
  search$ = new Subject<string>();
  filteredResults: MenuItem[] = [];
  private fuse!: Fuse<MenuItem>;
  selectedTargetTableId: string | null = null;
  orderIsConfirmed = false;
  currentOrderId: string | null = null;
  showCloseConfirm = false;
  resetConfirmVisible = false;

  /**
   * Sursa unică de adevăr pentru disponibilitatea meselor.
   * Derivată din this.tables[] via buildAvailabilityMap și sincronizată în Dexie.
   */
  tablesAvailable: Record<string, boolean> = {};

  tableComputed: Record<string, {
    lastActionAt: string;
    lastAddedItem: string;
    total: number;
    currency: string;
    itemCount: number;
    cssClass: string;
    initiatedBy: string;
  }> = {};

  constructor(
    private tablesService: TablesService,
    private menuItemService: MenuItemServiceService,
    private authService: AuthService,
    private ordersService: OrdersService,
    private sseService: OrderSyncService,
    private kitchenService: KitchenService,
    private barService: BarService,
    private miscService: MiscellaneousService,
    private offlineDB: OfflineDbService,
    private onlineStateService: OnlineStateService,
    private queueProcessor: OfflineQueueProcessor,
    private appToast: AppToastService,
    private transloco: TranslocoService,
  ) {}

  formatInitiatedBy(raw: string): string {
    const v = (raw ?? '').trim().toLowerCase();
    if (!v) return '';
    if (v === 'stripe') return this.transloco.translate('manageOrders.byCardPayment');
    return raw;
  }

  // ─── GETTERS ──────────────────────────────────────────────────────────────────

  get isOnline() { return this.onlineStateService.isOnline; }

  get filteredMenuItems(): MenuItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return [];
    return this.menuItems.filter(i => i.menuItemName.toLowerCase().includes(term));
  }

  get selectedItems(): CartItem[] {
    return this.tableCarts[this.currentTableId] ?? [];
  }

  get filteredItems() {
    return this.menuItems.filter(i => i.category === this.selectedCategory);
  }

  get groupedMenuItems(): { [category: string]: MenuItem[] } {
    return this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  get nonEmptyCategories(): string[] {
    return this.categories.filter(cat => this.groupedMenuItems[cat]?.length > 0);
  }

  /**
   * Mese libere pentru mutare: exclude masa curentă, bazat pe tablesAvailable.
   */
  get availableTablesForMove(): TableDTO[] {
    return this.tables.filter(t =>
      t.tableId !== this.currentTableId &&
      this.tablesAvailable[t.tableId] === true
    );
  }

  get cartSubTotal(): number {
    const cart = this.tableCarts[this.currentTableId] ?? [];
    return cart.reduce((sum, s) => sum + s.item.menuItemPriceAmount * s.quantity, 0);
  }

  get cartCurrency(): string | undefined {
    return this.tableCarts[this.currentTableId]?.[0]?.item.menuItemPriceCurrency;
  }

  /**
   * FIX BUG 5: Anterior verifica Object.values(tablesAvailable).some(v => v === true)
   * fără să excludă masa curentă → putea returna true fără ținte reale.
   * Acum folosește availableTablesForMove care exclude corect masa curentă.
   */
  canMoveOrder(): boolean {
    return (
      this.isOnline &&
      this.orderIsConfirmed &&
      !!this.currentOrderId &&
      !this.currentOrderId.startsWith('local-') &&
      this.availableTablesForMove.length > 0
    );
  }

  // ─── KEYBOARD ─────────────────────────────────────────────────────────────────

  @HostListener('document:keydown.escape')
  onEscPressed() {
    if (this.searchTerm) {
      this.searchTerm = '';
      this.filteredResults = [];
      (document.querySelector('#searchInput') as HTMLInputElement)?.focus();
    }
  }

  trackByTableId(_: number, table: TableDTO) { return table.tableId; }

  // ─── ORDER ACTIONS ────────────────────────────────────────────────────────────

  async confirmOrder() {
    if (document.hidden) return;

    const localOrderId = 'local-' + crypto.randomUUID();
    this.currentOrderId = localOrderId;
    this.orderIsConfirmed = true;

    const cart = await this.offlineDB.loadCart(this.currentTableId);
    await this.offlineDB.saveCart(this.currentTableId, cart, localOrderId);

    await this.offlineDB.addOfflineAction({
      type: 'NEW_ORDER',
      restaurantId: this.restaurantId,
      tableId: this.currentTableId,
      orderId: localOrderId,
      payload: { seatId: this.seatId ?? null }
    });

    await this.offlineDB.addOfflineAction({
      type: 'INIT_ORDER_ITEMS_FINAL',
      restaurantId: this.restaurantId,
      tableId: this.currentTableId,
      orderId: localOrderId,
      payload: { items: cart.map(ci => ({ menuItemId: ci.item.menuItemId, quantity: ci.quantity })) }
    });

    this.markTableAsClosed(this.currentTableId);
    this.updateComputedLocal(this.currentTableId);

    if (this.onlineStateService.isOnline) this.queueProcessor.triggerProcessing();
  }

  async addCartItem(item: MenuItem) {
    const tableId = this.currentTableId;
    const record = await this.offlineDB.loadCartRecord(tableId);
    const orderId = record?.orderId ?? null;
    const cart = record?.items ?? [];

    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);
    if (existing) existing.quantity++;
    else cart.push({ item, quantity: 1, orderItemId: undefined });

    await this.offlineDB.saveCart(tableId, cart, orderId ?? undefined);
    this.tableCarts[tableId] = [...cart];

    if (!this.orderIsConfirmed) return;

    await this.offlineDB.addOfflineAction({
      type: existing ? 'UPDATE_QUANTITY' : 'ADD_ITEM',
      restaurantId: this.restaurantId,
      tableId,
      orderId: orderId ?? undefined,
      payload: {
        orderItemId: existing?.orderItemId ?? null,
        menuItemId: item.menuItemId,
        quantity: existing ? existing.quantity : 1
      }
    });

    if (this.onlineStateService.isOnline) this.queueProcessor.triggerProcessing();
  }

  updateComputedLocal(tableId: string) {
    const cart = this.tableCarts[tableId] ?? [];
    const table = this.tables.find(t => t.tableId === tableId);
    if (!table) return;

    this.tableComputed[tableId] = {
      lastActionAt: new Date().toISOString(),
      lastAddedItem: cart.length ? cart[cart.length - 1].item.menuItemName : '—',
      total: cart.reduce((s, c) => s + c.item.menuItemPriceAmount * c.quantity, 0),
      currency: cart[0]?.item.menuItemPriceCurrency ?? '',
      itemCount: cart.reduce((s, c) => s + c.quantity, 0),
      cssClass: this.miscService.getTableCss(table, this.waiterState),
      initiatedBy: this.tableComputed[tableId]?.initiatedBy ?? ''
    };

    this.ordersService.saveComputed(this.tableComputed);
  }

  private hydrateComputedFromTables(): void {
    // REST is authoritative for initial state; SSE only updates.
    // If SSE is temporarily down (expired token, reconnecting), this ensures totals aren't stuck at 0/undefined.
    for (const t of this.tables) {
      const order = t.order;

      // no order -> keep / ensure empty computed
      if (!order || !order.isOrderOpen) {
        this.tableComputed[t.tableId] = this.ordersService.mapComputedDtoToComputed(
          { tableId: t.tableId, isTableOpen: !!t.isTableOpen },
          this.tables,
          this.waiterState,
          this.tableComputed[t.tableId]?.initiatedBy ?? ''
        );
        continue;
      }

      const items = (order.orderItems ?? []).filter((x): x is NonNullable<typeof x> => !!x);
      const itemCount = items.reduce((s, i) => s + (i.quantity ?? 0), 0);

      const subtotalAmount =
        order.subTotal?.amount ??
        order.finalTotalPrice?.amount ??
        items.reduce((s, i) => s + ((i.orderItemPriceAmount ?? 0) * (i.quantity ?? 0)), 0);

      const currency =
        (order.subTotal?.currency ?? order.finalTotalPrice?.currency)?.toString?.() ?? '';

      const lastAddedItem =
        (items.length ? items[items.length - 1].orderItemName : null) ?? '—';

      this.tableComputed[t.tableId] = {
        lastActionAt: this.tableComputed[t.tableId]?.lastActionAt ?? '',
        lastAddedItem,
        total: subtotalAmount ?? 0,
        currency,
        itemCount,
        cssClass: this.miscService.getTableCss(t, this.waiterState),
        initiatedBy: this.tableComputed[t.tableId]?.initiatedBy ?? ''
      };
    }

    this.ordersService.saveComputed(this.tableComputed);
  }

  async decrementItem(sel: CartItem) {
    const tableId = this.currentTableId;
    const record = await this.offlineDB.loadCartRecord(tableId);
    const cart = await this.offlineDB.loadCart(tableId);
    const orderId = record?.orderId ?? null;

    const existing = cart.find(i => i.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    const willDelete = existing.quantity <= 1;
    const finalQuantity = willDelete ? 0 : existing.quantity - 1;

    if (willDelete) cart.splice(cart.indexOf(existing), 1);
    else existing.quantity--;

    this.tableCarts[tableId] = [...cart];
    await this.offlineDB.saveCart(tableId, cart, orderId ?? undefined, true);

    // Must enqueue DELETE/UPDATE before empty-cart close; otherwise the last removal never hits the API
    // and CLOSE_ORDER runs while the DB still has that line (e.g. only first delete-order-item in Network).
    const canSync =
      !orderId?.startsWith('local-') && this.orderIsConfirmed && !!existing.orderItemId;
    if (canSync) {
      await this.offlineDB.addOfflineAction({
        type: willDelete ? 'DELETE_ITEM' : 'UPDATE_QUANTITY',
        restaurantId: this.restaurantId,
        tableId,
        orderId: orderId ?? undefined,
        payload: { orderItemId: existing.orderItemId, menuItemId: existing.item.menuItemId, quantity: finalQuantity }
      });
      if (this.onlineStateService.isOnline) this.queueProcessor.triggerProcessing();
    }

    if (this.orderIsConfirmed && cart.length === 0) {
      await this.freeTableAfterEmptyConfirmedCart(tableId, orderId ?? undefined);
      return;
    }
  }

  async removeItem(sel: CartItem) {
    const tableId = this.currentTableId;
    const record = await this.offlineDB.loadCartRecord(tableId);
    const cart = await this.offlineDB.loadCart(tableId);
    const orderId = record?.orderId ?? null;

    const existing = cart.find(i => i.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    const newCart = cart.filter(i => i.item.menuItemId !== sel.item.menuItemId);
    this.tableCarts[tableId] = [...newCart];
    await this.offlineDB.saveCart(tableId, newCart, orderId ?? undefined, true);

    const canDeleteOnServer =
      !orderId?.startsWith('local-') && this.orderIsConfirmed && !!existing.orderItemId;
    if (canDeleteOnServer) {
      await this.offlineDB.addOfflineAction({
        type: 'DELETE_ITEM',
        restaurantId: this.restaurantId,
        tableId,
        orderId: orderId ?? undefined,
        payload: { orderItemId: existing.orderItemId, menuItemId: existing.item.menuItemId }
      });
      if (this.onlineStateService.isOnline) this.queueProcessor.triggerProcessing();
    }

    if (this.orderIsConfirmed && newCart.length === 0) {
      await this.freeTableAfterEmptyConfirmedCart(tableId, orderId ?? undefined);
      return;
    }
  }

  async openTable(table: TableDTO) {
    const tableId = table.tableId;
    this.currentTableId = tableId;
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;
    localStorage.setItem('currentTableId', tableId);

    const record = await this.offlineDB.loadCartRecord(tableId);
    if (record) {
      this.currentOrderId = record.orderId ?? null;
      this.orderIsConfirmed = !!this.currentOrderId && !this.currentOrderId.startsWith('local-');
      this.tableCarts[tableId] = record.items;
      return;
    }

    this.orderIsConfirmed = false;
    this.currentOrderId = null;
    this.tableCarts[tableId] = [];
  }

  async seeOrder(table: TableDTO) {
    this.currentTableId = table.tableId;
    localStorage.setItem('currentTableId', this.currentTableId);
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    const order = await this.ordersService.listOpenOrderForTableWithFallback(
      this.restaurantId, this.currentTableId
    );

    if (order) {
      this.currentOrderId = order.orderId;
      this.orderIsConfirmed = true;
      this.tableCarts[this.currentTableId] = (order.orderItems ?? []).map(o => ({
        item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
        quantity: o?.quantity ?? 0,
        orderItemId: o?.orderItemId
      }));
    }
  }

  snoozeWaiterCall(tableId: string): void {
    this.waiterState[tableId] = WaiterCallState.Snoozed;
    const table = this.tables.find(t => t.tableId === tableId);
    if (table && this.tableComputed[tableId]) {
      this.tableComputed[tableId].cssClass = this.miscService.getTableCss(table, this.waiterState);
    }
    this.tablesService.snoozeWaiterCall(this.restaurantId, tableId)
      .pipe(take(1))
      .subscribe({ error: (err: unknown) => console.error('Error snoozing waiter call', err) });
  }

  snoozeKitchenPickup(tableId: string): void {
    this.kitchenService.snoozePickupCall(this.restaurantId, tableId)
      .pipe(take(1))
      .subscribe({ error: (err: unknown) => console.error('Error snoozing kitchen pickup', err) });
  }

  snoozeBarPickup(tableId: string): void {
    this.barService.snoozePickupCall(this.restaurantId, tableId)
      .pipe(take(1))
      .subscribe({ error: (err: unknown) => console.error('Error snoozing bar pickup', err) });
  }

  // ─── MOVE ORDER ───────────────────────────────────────────────────────────────

  async moveCartToSelectedTable() {
    if (!this.canMoveOrder() || !this.selectedTargetTableId) return;

    const sourceId = this.currentTableId;
    const targetId = this.selectedTargetTableId;

    const record = await this.offlineDB.loadCartRecord(sourceId);
    if (!record) {
      this.appToast.error('No cart found for source table.');
      this.selectedTargetTableId = null;
      return;
    }

    if (this.tablesAvailable[targetId] !== true) {
      this.appToast.error('Target table appears occupied. Refreshing status...');
      await this.syncTablesAvailability();
      this.selectedTargetTableId = null;
      return;
    }

    try {
      const res = await firstValueFrom(
        this.ordersService.moveOrder(this.restaurantId, sourceId, targetId)
      );

      const finalOrderId = res?.orderId ?? record.orderId;

      // Actualizare Dexie
      await this.offlineDB.saveCart(targetId, record.items, finalOrderId);
      await this.offlineDB.deleteCart(sourceId);

      // FIX BUG 1 + BUG 4:
      // Actualizăm this.tables[] imediat cu obiecte NOI (spread) → Angular detectează schimbarea
      // → CSS / culori se schimbă instant, fără să așteptăm SSE.
      // - targetId: isTableOpen=false (ocupat), order simulat (non-null)
      // - sourceId: isTableOpen=true (liber), order=null → buildAvailabilityMap returnează corect true
      this.tables = this.tables.map(t => {
        if (t.tableId === targetId) return { ...t, isTableOpen: false, order: { orderId: finalOrderId } as unknown as OrderDTO };
        if (t.tableId === sourceId) return { ...t, isTableOpen: true, order: undefined };
        return t;
      });
      this.refreshTableLists();

      // FIX BUG 2:
      // Actualizăm tableComputed imediat după move — SSE va suprascrie cu datele reale.
      this.tableCarts[targetId] = record.items;
      this.tableCarts[sourceId] = [];
      this.updateComputedLocal(targetId);  // total, lastAddedItem, lastActionAt pentru masa ocupată
      // Resetăm computed pentru masa eliberată
      const sourceTable = this.tables.find(t => t.tableId === sourceId)!;
      this.tableComputed[sourceId] = {
        lastActionAt: new Date().toISOString(),
        lastAddedItem: '—',
        total: 0,
        currency: '—',
        itemCount: 0,
        cssClass: this.miscService.getTableCss(sourceTable, this.waiterState),
        initiatedBy: this.tableComputed[sourceId]?.initiatedBy ?? 'system'
      };

      // FIX BUG 3: buildAvailabilityMap citește !t.order — acum sourceId are order=null → correct true
      await this.offlineDB.upsertTableStatus(targetId, false);
      await this.offlineDB.upsertTableStatus(sourceId, true);
      this.tablesAvailable = this.tablesService.buildAvailabilityMap(this.tables);

      // Comutăm contextul UI pe masa țintă
      this.currentTableId = targetId;
      this.tableName = this.tables.find(t => t.tableId === targetId)?.tableName ?? '';
      this.orderIsConfirmed = true;
      this.currentOrderId = finalOrderId ?? null;
      this.tableCarts = await this.offlineDB.loadAllCarts();

      this.ordersService.saveComputed(this.tableComputed);
      this.appToast.success('Order moved successfully.');

    } catch (err: any) {
      if (err?.status === 409) {
        const parsed = this.miscService.parseApiError?.(err) ?? { details: undefined };
        this.appToast.error(parsed.details ?? 'Target table is occupied. Move aborted.');
        await this.syncTablesAvailability();
      } else {
        this.appToast.error('Failed to move order. Please try again.');
      }
    } finally {
      this.selectedTargetTableId = null;
    }
  }

  /**
   * Re-fetch tables de la server și sincronizează complet starea locală.
   * Singurul loc din cod care face asta — apelat după conflict (pre-flight sau 409).
   */
  private async syncTablesAvailability(): Promise<void> {
    try {
      const tables = await firstValueFrom(this.tablesService.getAll(this.restaurantId));
      await this.offlineDB.saveTables(tables);
      const map = this.tablesService.buildAvailabilityMap(tables);
      await this.offlineDB.saveTablesStatus(map);
      this.tables = tables;   // referință nouă → Angular detectează
      this.tablesAvailable = map;
      this.refreshTableLists();
    } catch (err) {
      console.warn('[syncTablesAvailability] Failed to refresh:', err);
    }
  }

  // ─── CLOSE ORDER ──────────────────────────────────────────────────────────────

  closeOrder() { this.showCloseConfirm = true; }
  cancelCloseOrder() { this.showCloseConfirm = false; }

  async confirmCloseOrder() {
    if (document.hidden) return;
    this.showCloseConfirm = false;

    const tableId = this.currentTableId;
    const orderId = this.currentOrderId;

    // FIX BUG 6: currentOrderId poate fi null — înainte codul folosea ! (non-null assertion)
    // pe un câmp care în practică poate fi null dacă butonul e apăsat fără order activ.
    if (!orderId) {
      this.resetCanvasState();
      return;
    }

    if (orderId.startsWith('local-') || !this.onlineStateService.isOnline) {
      await this.offlineDB.addOfflineAction({
        type: 'CLOSE_ORDER',
        restaurantId: this.restaurantId,
        tableId,
        orderId,
        payload: {}
      });
      this.resetCanvasState();
      return;
    }

    this.ordersService.closeOrder(this.restaurantId, tableId, orderId).subscribe({
      next: async () => {
        await this.offlineDB.deleteCart(tableId);
        delete this.tableComputed[tableId];
        this.ordersService.saveComputed(this.tableComputed);
        this.tableCarts[tableId] = [];
        // If SSE is down, we still need to reflect close immediately (avoid stale red table).
        this.markTableAsOpen(tableId);
        await this.offlineDB.upsertTableStatus(tableId, true);
        this.tablesAvailable = this.tablesService.buildAvailabilityMap(this.tables);
        this.resetCanvasState();
      },
      error: err => console.error('Error closing order:', err)
    });
  }

  private resetCanvasState() {
    this.currentTableId = '';
    this.tableName = '';
    this.orderIsConfirmed = false;
    this.currentOrderId = null;
    this.canvasVisible = false;
  }

  printOrder() {}

  requestResetCanvas() {
    this.resetConfirmVisible = true;
  }

  cancelResetCanvas() {
    this.resetConfirmVisible = false;
  }

  async confirmResetCanvas() {
    this.resetConfirmVisible = false;
    if (!this.currentTableId) return;

    const tableId = this.currentTableId;
    const orderId = this.currentOrderId;

    await this.offlineDB.deleteCart(tableId);
    this.tableCarts[tableId] = [];

    if (orderId) {
      await this.offlineDB.deleteActionsForOrder(orderId);
    }

    delete this.tableComputed[tableId];
    this.ordersService.saveComputed(this.tableComputed);

    this.resetCanvasState();
  }

  private async freeTableAfterEmptyConfirmedCart(tableId: string, orderId?: string): Promise<void> {
    // UX rule: if a confirmed order ends up with 0 items (user deleted everything),
    // treat it as "free table" immediately (don't leave it red/occupied).
    await this.offlineDB.deleteCart(tableId);
    this.tableCarts[tableId] = [];
    delete this.tableComputed[tableId];
    this.ordersService.saveComputed(this.tableComputed);

    // enqueue close to backend if possible (best-effort)
    if (orderId) {
      await this.offlineDB.addOfflineAction({
        type: 'CLOSE_ORDER',
        restaurantId: this.restaurantId,
        tableId,
        orderId,
        payload: {}
      });
      if (this.onlineStateService.isOnline) this.queueProcessor.triggerProcessing();
    }

    this.markTableAsOpen(tableId);
    await this.offlineDB.upsertTableStatus(tableId, true);
    this.tablesAvailable = this.tablesService.buildAvailabilityMap(this.tables);

    if (this.currentTableId === tableId) {
      this.resetCanvasState();
    }
  }

  // ─── TABLE STATE HELPERS ──────────────────────────────────────────────────────

  /**
   * FIX BUG 4: Folosim map+spread în loc de mutație în-place.
   * Mutația directă pe obiect (table.isTableOpen = x) nu produce o referință nouă
   * → Angular change detection nu detectează schimbarea → UI nu se actualizează.
   */
  markTableAsClosed(tableId: string) {
    this.tables = this.tables.map(t =>
      t.tableId === tableId ? { ...t, isTableOpen: false } : t
    );
    this.refreshTableLists();
  }

  markTableAsOpen(tableId: string) {
    // FIX BUG 3: curățăm și order când deschidem masa, nu doar isTableOpen.
    // buildAvailabilityMap verifică !t.order → dacă order rămâne setat, masa
    // apare ca ocupată chiar dacă isTableOpen=true.
    this.tables = this.tables.map(t =>
      t.tableId === tableId ? { ...t, isTableOpen: true, order: undefined } : t
    );
    this.refreshTableLists();
  }

  refreshTableLists() {
    this.openTables = this.tables.filter(t => t.isTableOpen);
    this.closedTables = this.tables.filter(t => !t.isTableOpen);
  }

  getTableCss(table: TableDTO, waiterState: Record<string, WaiterCallState>): string {
    return this.miscService.getTableCss(table, waiterState);
  }

  getLastActionTime(ts: string | null): string {
    return this.miscService.getLastActionTime(ts);
  }

  // ─── SSE HANDLER ─────────────────────────────────────────────────────────────

  private async handleSseEvent({ EventType, Data, InitiatedBy, Sequence }: SseEvent<any>): Promise<void> {
    if (!EventType) return;
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

      case 'KitchenWaiterCall': {
        const tableId = Data?.TableId;
        if (tableId) {
          this.kitchenPickupRequested[tableId] = true;
          this.appToast.info(`Kitchen requests pickup at table ${this.tables.find(t => t.tableId === tableId)?.tableName ?? tableId}`);
          if (this.kitchenPickupTimers[tableId]) clearTimeout(this.kitchenPickupTimers[tableId]);
          this.kitchenPickupTimers[tableId] = setTimeout(() => {
            delete this.kitchenPickupRequested[tableId];
          }, 2 * 60 * 1000);
        }
        break;
      }

      case 'KitchenWaiterCallSnoozed': {
        const tableId = Data?.TableId;
        if (tableId) {
          delete this.kitchenPickupRequested[tableId];
          if (this.kitchenPickupTimers[tableId]) {
            clearTimeout(this.kitchenPickupTimers[tableId]);
            delete this.kitchenPickupTimers[tableId];
          }
        }
        break;
      }

      case 'BarWaiterCall': {
        const tableId = Data?.TableId;
        if (tableId) {
          this.barPickupRequested[tableId] = true;
          this.appToast.info(`Bar requests pickup at table ${this.tables.find(t => t.tableId === tableId)?.tableName ?? tableId}`);
          if (this.barPickupTimers[tableId]) clearTimeout(this.barPickupTimers[tableId]);
          this.barPickupTimers[tableId] = setTimeout(() => {
            delete this.barPickupRequested[tableId];
          }, 2 * 60 * 1000);
        }
        break;
      }

      case 'BarWaiterCallSnoozed': {
        const tableId = Data?.TableId;
        if (tableId) {
          delete this.barPickupRequested[tableId];
          if (this.barPickupTimers[tableId]) {
            clearTimeout(this.barPickupTimers[tableId]);
            delete this.barPickupTimers[tableId];
          }
        }
        break;
      }

      case 'WaiterCall':
        this.waiterState[Data.TableId] = WaiterCallState.Active;
        break;

      case 'WaiterCallSnoozed':
        this.waiterState[Data.TableId] = WaiterCallState.Snoozed;
        break;

      case 'OrderItemDeleted': {
        const tableId = Data.TableId ?? this.currentTableId;
        if (this.tableCarts[tableId]) {
          this.tableCarts[tableId] = this.tableCarts[tableId].filter(
            i => i.orderItemId !== Data.OrderItemId
          );
          delete this.tableComputed[tableId];
          await this.offlineDB.saveCart(tableId, this.tableCarts[tableId], this.currentOrderId ?? undefined);
        }
        break;
      }

      case 'NewOrderPrivateEvent': {
        const realId = Data.OrderId;
        const tableId = Data.TableId;
        if (this.currentTableId === tableId) {
          this.currentOrderId = realId;
          this.orderIsConfirmed = true;
        }
        const record = await this.offlineDB.loadCartRecord(tableId);
        if (record) await this.offlineDB.saveCart(tableId, record.items, realId);
        break;
      }

      case 'OrderUpdated': {
        if (this.currentOrderId?.startsWith('local-')) break;
        const payload = Data as OrderUpdatedSSEPayload;
        const tableId = payload.TableId;
        const cart = await this.offlineDB.loadCart(tableId);

        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'feature',hypothesisId:'H_overwrite',location:'manage-orders.component.ts:OrderUpdated',message:'OrderUpdated received; overwrites initiatedBy',data:{tableId,initiatedBy:InitiatedBy||null,hadExisting:!!this.tableComputed?.[tableId]},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log

        for (const sseItem of payload.Items) {
          const localItem = cart.find(ci => ci.item.menuItemId === sseItem.MenuItemId);
          if (localItem) localItem.orderItemId = sseItem.OrderItemId;
        }

        await this.offlineDB.saveCart(tableId, cart, payload.OrderId);
        this.tableComputed[tableId] = this.ordersService.mapPayloadToComputed(
          payload, this.tables, this.waiterState, InitiatedBy
        );
        this.tableCarts[tableId] = cart;
        break;
      }

      case 'OrderClosedWithPayment': {
        const tableId = Data.TableId;
        await this.offlineDB.deleteCart(tableId);
        // Persist "updated by" until the next order overwrites it.
        const existing = this.tableComputed[tableId];
        const table = this.tables.find(t => t.tableId === tableId);
        this.tableComputed[tableId] = {
          lastActionAt: Data.ClosedAt ?? existing?.lastActionAt ?? new Date().toISOString(),
          lastAddedItem: '—',
          total: 0,
          currency: existing?.currency ?? '',
          itemCount: 0,
          cssClass: existing?.cssClass ?? this.miscService.getTableCss(table!, this.waiterState),
          initiatedBy: InitiatedBy || 'stripe',
        };
        this.ordersService.saveComputed(this.tableComputed);

        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'feature',hypothesisId:'H_persist',location:'manage-orders.component.ts:OrderClosedWithPayment',message:'OrderClosedWithPayment persisted initiatedBy',data:{tableId,initiatedBy:this.tableComputed?.[tableId]?.initiatedBy||null,lastActionAt:this.tableComputed?.[tableId]?.lastActionAt||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log

        delete this.kitchenPickupRequested[tableId];
        delete this.barPickupRequested[tableId];
        // FIX BUG 3: markTableAsOpen curăță și order → buildAvailabilityMap returnează corect true
        this.markTableAsOpen(tableId);
        if (this.currentTableId === tableId) {
          this.tableCarts[tableId] = [];
          this.resetCanvasState();
        }
        break;
      }

      case 'TablesStatusesUpdate': {
        const computedList = Data as TableComputedDTO[];

        // IMPORTANT:
        // Backend may emit TablesStatusesUpdate snapshots where orderId/subTotal are not yet consistent
        // with a just-confirmed order (race / eventual consistency). Don't let that overwrite local truth.
        const updatedTables: TableDTO[] = [];
        for (const t of this.tables) {
          if (!t?.tableId) continue;
          const c = computedList.find(x => x.tableId === t.tableId);
          if (!c) {
            updatedTables.push(t);
            continue;
          }

          const localRecord = await this.offlineDB.loadCartRecord(t.tableId);
          const localHasOrder = !!localRecord?.orderId || (localRecord?.items?.length ?? 0) > 0;

          // Only accept "freed" snapshot if we do NOT have local evidence of an open order.
          const snapshotSaysFreed = c.isTableOpen && !c.orderId;
          const allowFreeOverride = snapshotSaysFreed && !localHasOrder;

          if (allowFreeOverride) {
            updatedTables.push({ ...t, isTableOpen: true, order: undefined });
            continue;
          }

          // Otherwise: keep occupied if localHasOrder, and only take snapshot's isTableOpen when it doesn't conflict.
          // If snapshot says occupied (isTableOpen=false), accept it.
          const nextIsTableOpen = localHasOrder ? false : c.isTableOpen;
          updatedTables.push({ ...t, isTableOpen: nextIsTableOpen });
        }
        this.tables = updatedTables;
        this.refreshTableLists();

        for (const c of computedList) {
          if (!c?.tableId) continue;
          const table = this.tables.find(t => t.tableId === c.tableId);
          if (!table) continue;

          const localRecord = await this.offlineDB.loadCartRecord(c.tableId);
          const localHasOrder = !!localRecord?.orderId || (localRecord?.items?.length ?? 0) > 0;

          // Avoid overwriting a locally-confirmed cart subtotal with snapshot zeros.
          if (localHasOrder && (c.subTotal?.amount ?? 0) === 0) {
            continue;
          }

          this.tableComputed[c.tableId] = this.ordersService.mapComputedDtoToComputed(
            c, this.tables, this.waiterState, this.tableComputed[c.tableId]?.initiatedBy ?? ''
          );
        }

        this.ordersService.saveComputed(this.tableComputed);
        this.tablesAvailable = this.tablesService.buildAvailabilityMap(this.tables);
        break;
      }

      case 'MoveOrderAtTableUpdate': {
        const computedList = Data as TableComputedDTO[];

        this.tables = this.tables.map(t => {
          const c = computedList.find(x => x.tableId === t.tableId);
          if (!c) return t;
          const isFreed = c.isTableOpen && !c.orderId;
          return { ...t, isTableOpen: c.isTableOpen, order: isFreed ? undefined : t.order };
        });

        for (const c of computedList) {
          const table = this.tables.find(t => t.tableId === c.tableId);
          if (!table) continue;
          this.tableComputed[c.tableId] = this.ordersService.mapComputedDtoToComputed(
            c, this.tables, this.waiterState, this.tableComputed[c.tableId]?.initiatedBy ?? ''
          );
        }
        
        await this.offlineDB.saveTables(this.tables);
        this.tablesAvailable = this.tablesService.buildAvailabilityMap(this.tables);
        this.refreshTableLists();
        this.ordersService.saveComputed(this.tableComputed);
        break;
      }

      case 'OrderItemAdded':
      case 'OrderItemQuantityUpdated':
        // Gestionate via OrderUpdated
        break;

      default:
        console.warn('Unknown SSE event:', EventType);
    }
  }

  // ─── LIFECYCLE ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.sseService.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ev => this.handleSseEvent(ev));

    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user?.restaurantId),
        take(1)
      )
      .subscribe(user => {
        this.restaurantId = user.restaurantId!;

        forkJoin({
          tables: from(this.tablesService.getAllWithFallback(this.restaurantId)),
          menu: from(this.menuItemService.getAllWithFallback(this.restaurantId))
        }).subscribe(async ({ tables, menu }) => {
          this.tables = tables;
          this.refreshTableLists();

          this.menuItems = menu.menuItems ?? [];
          this.categories = menu.categories ?? [];
          this.tablesAvailable = await this.offlineDB.loadTablesStatusMap();
          this.tableComputed = this.ordersService.loadComputed() || {};

          this.hydrateComputedFromTables();

          Object.keys(this.tableComputed).forEach(tableId => {
            const table = this.tables.find(t => t.tableId === tableId);
            if (table) {
              this.tableComputed[tableId].cssClass = this.miscService.getTableCss(table, this.waiterState);
            }
          });

          this.tableCarts = await this.offlineDB.loadAllCarts();

          const savedTableId = localStorage.getItem('currentTableId');
          if (savedTableId) {
            const table = this.tables.find(t => t.tableId === savedTableId);
            if (table) this.openTable(table);
          }
        });

        this.queueProcessor.orderConfirmed$
          .pipe(takeUntil(this.destroy$))
          .subscribe(async ({ tableId, orderId }) => {
            const cart = await this.offlineDB.loadCart(tableId);
            this.tableCarts[tableId] = [...cart];
            if (this.currentTableId === tableId) {
              this.currentOrderId = orderId;
              this.orderIsConfirmed = true;
            }
            this.markTableAsClosed(tableId);
            this.updateComputedLocal(tableId);
          });

        this.search$
          .pipe(debounceTime(250), takeUntil(this.destroy$))
          .subscribe(term => {
            if (!term.trim()) { this.filteredResults = []; return; }
            this.filteredResults = this.fuse.search(term).map(r => r.item);
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    Object.values(this.kitchenPickupTimers).forEach(t => clearTimeout(t));
    Object.values(this.barPickupTimers).forEach(t => clearTimeout(t));
  }
}