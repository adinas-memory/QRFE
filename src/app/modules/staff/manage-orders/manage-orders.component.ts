import { ButtonsComponent } from '../../../views/buttons/buttons/buttons.component';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
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
import { filter, Subject, take, takeUntil, debounceTime, forkJoin, from } from 'rxjs';
import { NgFor, NgIf, NgStyle, CurrencyPipe, JsonPipe, NgClass } from '@angular/common';
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
  OrderDTO,
  OrderUpdatedSSEPayload,
  TableComputedDTO
} from '../../../core/models/orderingModel';
import { OrderSyncService } from '../../../core/services/order-service/order-sync.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { OfflineDbService } from '../../../core/offline/offline-db';
import { OfflineQueueProcessor } from '../../../core/offline/offline-queue-processor.service';
import { SseEvent } from '../../../core/models/sseModel';
import { OnlineStateService } from '../../../core/offline/online-state-service';



@Component({
  selector: 'app-manage-orders',
  imports: [
    RowComponent, Tabs2Module, FormsModule,
    ColComponent, NgFor, NgIf, TableDirective,
    CardBodyComponent, CurrencyPipe, JsonPipe,
    CardComponent, CardGroupComponent, CardHeaderComponent,
    CardFooterComponent, ButtonsComponent, ButtonDirective,
    CardImgDirective, BadgeComponent, ButtonCloseDirective,
    CardTextDirective, CardTitleDirective, ColComponent,
    ColDirective, NgStyle, IconDirective, RouterLink,
    OffcanvasBodyComponent, OffcanvasComponent, OffcanvasHeaderComponent,
    OffcanvasTitleDirective, OffcanvasToggleDirective,
    NavComponent, DropdownComponent, DropdownItemDirective,
    DropdownMenuDirective, DropdownToggleDirective, NavItemComponent,
    NavLinkDirective, NgClass,
  ],
  styleUrls: ['./manage-orders.component.scss'],
  standalone: true,
  templateUrl: './manage-orders.component.html'
})
export class ManageOrdersComponent implements OnInit, OnDestroy {
  icons = { cilBellExclamation };
  private destroy$ = new Subject<void>();
  private restaurantId = '';
  waiterState: Record<string, WaiterCallState> = {};
  WaiterCallState = WaiterCallState; modalVisible = false;
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
  subTotal: number = 0;
  searchTerm: string = '';
  search$ = new Subject<string>();
  filteredResults: MenuItem[] = [];
  private fuse!: Fuse<MenuItem>;
  selectedTargetTableId: string | null = null;
  orderIsConfirmed = false;
  currentOrderId: string | null = null;
  showCloseConfirm = false;

  tableComputed: Record<string, {
    lastActionAt: string;
    lastAddedItem: string;
    total: number;
    currency: string;
    itemCount: number;
    cssClass: string;
  }> = {};

  constructor(
    private tablesService: TablesService,
    private menuItemService: MenuItemServiceService,
    private authService: AuthService,
    private ordersService: OrdersService,
    private sseService: OrderSyncService,
    private miscService: MiscellaneousService,
    private offlineDB: OfflineDbService,
    private onlineStateService: OnlineStateService,
    private queueProcessor: OfflineQueueProcessor,
  ) { }

  @HostListener('document:keydown.escape', ['$event'])
  onEscPressed(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (this.searchTerm) {
      this.searchTerm = '';
      this.filteredResults = [];
      const input = document.querySelector('#searchInput') as HTMLInputElement;
      input?.focus();
    }
  }

  trackByTableId(index: number, table: TableDTO) { return table.tableId; }

  async confirmOrder() {
    if (document.hidden) return;

    const localOrderId = 'local-' + crypto.randomUUID();
    this.currentOrderId = localOrderId;
    this.orderIsConfirmed = true;

    const cart = await this.offlineDB.loadCart(this.currentTableId);

    // 1. NEW_ORDER → queue
    await this.offlineDB.addOfflineAction({
      type: 'NEW_ORDER',
      restaurantId: this.restaurantId,
      tableId: this.currentTableId,
      orderId: localOrderId,
      payload: { seatId: this.seatId ?? null }
    });

    // 2. INIT_ORDER_ITEMS_FINAL → snapshot complet
    await this.offlineDB.addOfflineAction({
      type: 'INIT_ORDER_ITEMS_FINAL',
      restaurantId: this.restaurantId,
      tableId: this.currentTableId,
      orderId: localOrderId,
      payload: {
        items: cart.map(ci => ({
          menuItemId: ci.item.menuItemId,
          quantity: ci.quantity
        }))
      }
    });

    // 3. UI update local
    this.markTableAsClosed(this.currentTableId);
    this.updateComputedLocal(this.currentTableId);

    // 4. Dacă suntem online → pornim sync
    if (this.onlineStateService.isOnline) {
      this.sseService.trySyncNow();
    }
    // După confirmare, recitim cart-ul din Dexie
    // După confirmare, recitim cart-ul din Dexie până când orderId devine real
    let attempts = 0;
    const maxAttempts = 20; // ~2 secunde

    const interval = setInterval(async () => {
      attempts++;

      const record = await this.offlineDB.loadCartRecord(this.currentTableId);

      if (record?.orderId && !record.orderId.startsWith('local-')) {
        // Avem orderId real
        this.currentOrderId = record.orderId;
        this.orderIsConfirmed = true;
        this.tableCarts[this.currentTableId] = record.items;
        clearInterval(interval);
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);

  }



  //#region Getters 
  get filteredMenuItems(): MenuItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return [];
    return this.menuItems.filter(item =>
      item.menuItemName.toLowerCase().includes(term)
    );
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
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  get nonEmptyCategories(): string[] {
    return this.categories.filter(cat =>
      this.groupedMenuItems[cat]?.length > 0
    );
  }

  get availableTablesForMove(): TableDTO[] {
    return this.tables.filter(t =>
      t.tableId !== this.currentTableId &&
      t.isTableOpen &&
      !t.order
    );
  }

  get cartSubTotal(): number {
    const cart = this.tableCarts[this.currentTableId] ?? [];
    return cart.reduce((sum, sel) =>
      sum + sel.item.menuItemPriceAmount * sel.quantity, 0
    );
  }

  get cartCurrency(): string | undefined {
    const cart = this.tableCarts[this.currentTableId] ?? [];
    return cart.length > 0 ? cart[0].item.menuItemPriceCurrency : undefined;
  }
  //#endregion

  async addCartItem(item: MenuItem) {
    if (document.hidden) return;
    const tableId = this.currentTableId;
    const record = await this.offlineDB.loadCartRecord(tableId);
    const orderId = record?.orderId ?? null;
    const cart = record ? record.items : [];
    console.log('Adding item to cart:', { item, tableId, cart });
    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);

    // UI update local
    if (existing) {
      existing.quantity++;
    } else {
      cart.push({ item, quantity: 1, orderItemId: undefined });
    }

    await this.offlineDB.saveCart(
      tableId,
      cart,
      orderId ?? undefined
    );

    this.tableCarts[tableId] = [...cart]; // actualizam UI cu cartul real din Dexie
    console.log('ORDERITEMID', existing?.orderItemId);
    // Dacă orderul nu e confirmat → doar local
    if (!this.orderIsConfirmed) return;

    // queue    
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

    // Dacă suntem online → backend (queueProcessor va trimite)
    if (this.onlineStateService.isOnline) {
      this.queueProcessor.triggerProcessing();
    }

  }


  updateComputedLocal(tableId: string) {
    const cart = this.tableCarts[tableId] ?? [];

    const table = this.tables.find(t => t.tableId === tableId);
    if (!table) {
      console.warn('[updateComputedLocal] Table not found:', tableId);
      return;
    }

    this.tableComputed[tableId] = {
      lastActionAt: new Date().toISOString(),
      lastAddedItem: cart.length ? cart[cart.length - 1].item.menuItemName : '—',
      total: cart.reduce((s, c) => s + c.item.menuItemPriceAmount * c.quantity, 0),
      currency: cart[0]?.item.menuItemPriceCurrency ?? 'EUR',
      itemCount: cart.reduce((s, c) => s + c.quantity, 0),
      cssClass: this.miscService.getTableCss(table, this.waiterState)
    };

    this.ordersService.saveComputed(this.tableComputed);
  }

  async decrementItem(sel: CartItem) {
    if (document.hidden) return;

    const tableId = this.currentTableId;
    const record = await this.offlineDB.loadCartRecord(tableId);
    const cart = await this.offlineDB.loadCart(tableId);
    const orderId = record?.orderId ?? null;

    const existing = cart.find(i => i.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    // Determinăm tipul acțiunii ÎNAINTE să modificăm starea
    const willDelete = existing.quantity <= 1;
    const finalQuantity = willDelete ? 0 : existing.quantity - 1;

    if (willDelete) {
      cart.splice(cart.indexOf(existing), 1);
    } else {
      existing.quantity--;
    }

    this.tableCarts[tableId] = [...cart];
    await this.offlineDB.saveCart(tableId, cart, orderId ?? undefined);

    if (orderId?.startsWith('local-')) return;
    if (!this.orderIsConfirmed) return;
    if (!existing.orderItemId) return;

    await this.offlineDB.addOfflineAction({
      type: willDelete ? 'DELETE_ITEM' : 'UPDATE_QUANTITY',
      restaurantId: this.restaurantId,
      tableId,
      orderId: orderId ?? undefined,
      payload: {
        orderItemId: existing.orderItemId,
        menuItemId: existing.item.menuItemId, // ← adaugă și asta pentru compressQueue
        quantity: finalQuantity
      }
    });

    if (this.onlineStateService.isOnline) {
      this.queueProcessor.triggerProcessing();
    }
  }

  // async decrementItem(sel: CartItem) {
  //   if (document.hidden) return;

  //   const tableId = this.currentTableId;

  //   // 1. Încărcăm cart-ul REAL din Dexie
  //   const record = await this.offlineDB.loadCartRecord(tableId);
  //   const cart = await this.offlineDB.loadCart(tableId);
  //   const orderId = record?.orderId ?? null;
  //   // console.log('Decrementing item in cart:', cart );

  //   this.tableCarts[tableId] = [...cart]; // actualizam UI cu cartul real din Dexie

  //   const existing = cart.find(i => i.item.menuItemId === sel.item.menuItemId);
  //   console.log('Found existing item in cart for decrement:', existing);
  //   if (!existing) return;

  //   // 2. UI update local
  //   if (existing.quantity > 1) {
  //     existing.quantity--;
  //   } else {
  //     // existing.quantity = 0;
  //     cart.splice(cart.indexOf(existing), 1);
  //   }

  //   // 3. Salvăm în Dexie
  //   await this.offlineDB.saveCart(tableId, cart, orderId ?? undefined);


  //   console.log('tableId:', tableId, 'Current cart after decrement:', cart, 'currentOrderId:', this.currentOrderId);

  //   // this.tableCarts[tableId] = await this.offlineDB.loadCart(tableId); // re-sync UI with Dexie after update
  //   console.log('CART2', this.tableCarts[tableId]);
  //   // 4. Dacă orderId este local → stop
  //   if (orderId?.startsWith('local-')) return;
  //   if (!this.orderIsConfirmed) return;

  //   // 5. Dacă nu avem orderItemId → așteptăm SSE
  //   if (!existing.orderItemId) return;

  //   // 6. Queue action
  //   await this.offlineDB.addOfflineAction({
  //     type: existing.quantity > 0 ? 'UPDATE_QUANTITY' : 'DELETE_ITEM',
  //     restaurantId: this.restaurantId,
  //     tableId,
  //     orderId: orderId ?? undefined,
  //     payload: {
  //       orderItemId: existing.orderItemId,        
  //       quantity: existing.quantity
  //     }
  //   });

  //   if (this.onlineStateService.isOnline) {
  //     this.queueProcessor.triggerProcessing();
  //   }
  // }


  async removeItem(sel: CartItem) {
    if (document.hidden) return;

    const tableId = this.currentTableId;

    // 1. Încărcăm cart-ul REAL din Dexie
    const record = await this.offlineDB.loadCartRecord(tableId);
    const cart = await this.offlineDB.loadCart(tableId);
    const orderId = record?.orderId ?? null;

    this.tableCarts[tableId] = [...cart]; // actualizam UI cu cartul real din Dexie

    const existing = cart.find(i => i.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    // 2. UI update local (în memorie)
    const newCart = cart.filter(i => i.item.menuItemId !== sel.item.menuItemId);
    console.log('Removing item from cart:', { sel, tableId, cart, newCart });

    // 3. Salvăm în Dexie
    await this.offlineDB.saveCart(tableId, newCart, orderId ?? undefined);

    // 4. Dacă orderId este local → stop
    if (orderId?.startsWith('local-')) return;
    if (!this.orderIsConfirmed) return;

    // 5. Dacă nu avem orderItemId → așteptăm SSE
    if (!existing.orderItemId) return;

    // 6. Queue action
    await this.offlineDB.addOfflineAction({
      type: 'DELETE_ITEM',
      restaurantId: this.restaurantId,
      tableId,
      orderId: orderId ?? undefined,
      payload: {
        orderItemId: existing.orderItemId
      }
    });

    if (this.onlineStateService.isOnline) {
      this.queueProcessor.triggerProcessing();
    }
  }


  async openTable(table: TableDTO) {
    const tableId = table.tableId;
    this.currentTableId = tableId;
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    localStorage.setItem('currentTableId', tableId);

    // 1. Citim doar din Dexie
    const record = await this.offlineDB.loadCartRecord(tableId);

    if (record) {
      this.currentOrderId = record.orderId ?? null;
      this.orderIsConfirmed = !!this.currentOrderId && !this.currentOrderId.startsWith('local-');
      this.tableCarts[tableId] = record.items;
      return;
    }

    // 2. Dacă nu există nimic în Dexie → masă goală
    this.orderIsConfirmed = false;
    this.currentOrderId = null;
    this.tableCarts[tableId] = [];
  }



  loadTables(): void {
    this.tablesService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.tables = response;
          this.refreshTableLists();
        },
        error: err => console.error('[ManageTablesComponent] Error loading tables', err)
      });
  }

  async seeOrder(table: TableDTO) {
    this.currentTableId = table.tableId;
    localStorage.setItem('currentTableId', this.currentTableId);
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    const order = await this.ordersService.listOpenOrderForTableWithFallback(this.restaurantId, this.currentTableId);

    if (order) {
      this.currentOrderId = order.orderId;
      this.orderIsConfirmed = true;

      this.tableCarts[this.currentTableId] = order.orderItems!.map(o => ({
        item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
        quantity: o?.quantity ?? 0,
        orderItemId: o?.orderItemId
      }));
    }
  }

  snoozeWaiterCall(tableId: string): void {
    this.tablesService.snoozeWaiterCall(this.restaurantId, tableId)
      .pipe(take(1))
      .subscribe({
        next: () => { },
        error: (err: unknown) => console.error('Error snoozing waiter call', err)
      });
  }

  async moveCartToSelectedTable() {
    if (!this.selectedTargetTableId) return;

    const sourceId = this.currentTableId;
    const targetId = this.selectedTargetTableId;

    if (!this.tableCarts[sourceId]) return;

    this.tableCarts[targetId] = this.tableCarts[sourceId];
    delete this.tableCarts[sourceId];

    await this.offlineDB.saveCart(
      this.currentTableId,
      this.tableCarts[this.currentTableId],
      this.currentOrderId ?? undefined
    );

    const targetTable = this.tables.find(t => t.tableId === targetId);
    this.currentTableId = targetId;
    this.tableName = targetTable?.tableName ?? '';

    this.selectedTargetTableId = null;
  }

  closeOrder() {
    this.showCloseConfirm = true;
  }

  cancelCloseOrder() {
    this.showCloseConfirm = false;
  }

  async confirmCloseOrder() {
    if (document.hidden) {
      console.log('[CONFIRM] Tab hidden → skip confirmOrder');
      return;
    }
    this.showCloseConfirm = false;

    const tableId = this.currentTableId;
    const orderId = this.currentOrderId!;

    // 3. OFFLINE → punem în coadă
    if (!this.onlineStateService.isOnline) {
      await this.offlineDB.addOfflineAction({
        type: 'CLOSE_ORDER',
        restaurantId: this.restaurantId,
        tableId,
        orderId,
        payload: {}
      });

      this.currentTableId = '';
      this.tableName = '';
      this.orderIsConfirmed = false;
      this.canvasVisible = false;
      return;
    }

    // 4. ONLINE → trimitem direct
    this.ordersService.closeOrder(
      this.restaurantId,
      tableId,
      orderId
    ).subscribe({
      next: async () => {
        await this.offlineDB.deleteCart(tableId);
        delete this.tableComputed[tableId];
        this.tableCarts[tableId] = [];
        this.currentTableId = '';
        this.tableName = '';
        this.orderIsConfirmed = false;
        this.canvasVisible = false;
      },
      error: err => console.error('Error closing order:', err)
    });
  }

  markTableAsClosed(tableId: string) {
    const updated = this.tables.map(t =>
      t.tableId === tableId ? { ...t, isTableOpen: false } : { ...t }
    );

    this.tables = [...updated];
    this.refreshTableLists();
  }

  markTableAsOpen(tableId: string) {
    const updated = this.tables.map(t =>
      t.tableId === tableId ? { ...t, isTableOpen: true } : { ...t }
    );

    this.tables = [...updated];
    this.refreshTableLists();
  }

  refreshTableLists() {
    this.openTables = this.tables.filter(t => t.isTableOpen);
    this.closedTables = this.tables.filter(t => !t.isTableOpen);
  }

  private async handleSseEvent({ EventType, Data }: SseEvent<any>) {
    if (!EventType) return;

    switch (EventType) {

      case 'WaiterCall':
        this.waiterState[Data.TableId] = WaiterCallState.Active;
        break;

      case 'WaiterCallSnoozed':
        this.waiterState[Data.TableId] = WaiterCallState.Snoozed;
        break;

      case 'OrderItemDeleted': {
        const tableId = Data.TableId ?? this.currentTableId;
        const orderItemId = Data.OrderItemId;

        console.log('Order item deleted event received', Data);

        if (this.tableCarts[tableId]) {
          this.tableCarts[tableId] = this.tableCarts[tableId].filter(
            i => i.orderItemId !== orderItemId
          );
          delete this.tableComputed[tableId];
          await this.offlineDB.saveCart(
            this.currentTableId,
            this.tableCarts[this.currentTableId],
            this.currentOrderId ?? undefined
          );
        }
        break;
      }

      case 'NewOrderPrivateEvent': {
        const realId = Data.OrderId;
        const tableId = Data.TableId;
        // 🔥 ÎNTOTDEAUNA actualizăm orderId-ul pentru masa respectivă
        if (this.currentTableId === tableId) {
          this.currentOrderId = realId;
          this.orderIsConfirmed = true;
        }
        // injectăm orderId în Dexie
        const record = await this.offlineDB.loadCartRecord(tableId);
        if (record) {
          await this.offlineDB.saveCart(tableId, record.items, realId);
        }
        break;
      }

      case 'OrderUpdated': {
        if (this.currentOrderId?.startsWith('local-')) {
          console.log('[SSE] Ignoring snapshot save for local order');
          break;
        }

        const payload = Data as OrderUpdatedSSEPayload;
        const tableId = payload.TableId;

        // 1. Luăm cart-ul din Dexie (adevărul local)
        const cart = await this.offlineDB.loadCart(tableId);

        // 2. Injectăm orderItemId în itemele existente
        for (const sseItem of payload.Items) {
          const localItem = cart.find(ci => ci.item.menuItemId === sseItem.MenuItemId);
          if (localItem) {
            localItem.orderItemId = sseItem.OrderItemId;
          }
        }

        // 4. Salvăm în Dexie (fără să stricăm offline)
        await this.offlineDB.saveCart(
          tableId,
          cart,
          payload.OrderId
        );

        // 3. Actualizăm computed
        this.tableComputed[tableId] =
          this.ordersService.mapPayloadToComputed(
            payload,
            this.tables,
            this.waiterState
          );

        // 5. Reîncărcăm cart-ul din Dexie → UI devine 100% corect
        this.tableCarts[tableId] = cart;

        break;
      }


      case 'OrderClosedWithPayment':
        console.log('Order closed event received', Data);
        const tableId = Data.TableId;
        await this.offlineDB.deleteCart(tableId);
        // this.tableCarts[tableId] = [];
        // delete this.tableComputed[tableId];
        this.markTableAsOpen(tableId);
        if (this.currentTableId === tableId) {
          this.orderIsConfirmed = false;
          this.canvasVisible = false;
          this.currentTableId = '';
          this.tableName = '';
          this.tableCarts[tableId] = [];
          await this.offlineDB.deleteCart(this.currentTableId);
        }

        break;

      case 'TablesStatusesUpdate': {
        const computedList = Data as TableComputedDTO[];
        this.tables = this.tables.map(t => {
          const c = computedList.find(x => x.tableId === t.tableId);
          return c ? { ...t, isTableOpen: c.isTableOpen } : t;
        });

        this.refreshTableLists();

        for (const c of computedList) {
          const table = this.tables.find(t => t.tableId === c.tableId);
          if (!table) continue;

          const existing = this.tableComputed[c.tableId] ?? {};

          this.tableComputed[c.tableId] = {
            ...existing,
            lastActionAt: c.lastActionAt ?? existing.lastActionAt,
            lastAddedItem: c.lastAddedItem ?? existing.lastAddedItem ?? '—',
            total: c.subTotal?.amount ?? existing.total ?? 0,
            currency: c.subTotal?.currency ?? existing.currency ?? 'EUR',
            itemCount: c.itemCount ?? existing.itemCount ?? 0,
            cssClass: this.miscService.getTableCss(table, this.waiterState)
          };
        }

        this.ordersService.saveComputed(this.tableComputed);
        break;
      }

      case 'OrderItemAdded':
        console.log('Order item added event received', Data);
        break;

      case 'OrderItemQuantityUpdated':
        console.log('Order item quantity updated event received', Data);
        break;

      default:
        console.warn('Unknown SSE event:', EventType);
    }
  }


  getTableCss(table: TableDTO, waiterState: Record<string, WaiterCallState>): string {
    return this.miscService.getTableCss(table, waiterState);
  }
  getLastActionTime(ts: string | null): string {
    return this.miscService.getLastActionTime(ts);
  }

  private areCartsEqual(a: CartItem[], b: CartItem[]): boolean {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];

      if (!x || !y) return false;

      if (x.item.menuItemId !== y.item.menuItemId) return false;
      if (x.quantity !== y.quantity) return false;
      if (x.orderItemId !== y.orderItemId) return false;
    }

    return true;
  }

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
        })
          .subscribe(async ({ tables, menu }) => {

            console.log('Initial data loaded', { tables, menu });

            // --- TABLES ---
            this.tables = tables;
            this.refreshTableLists();

            // --- MENU ---
            this.menuItems = menu.menuItems ?? [];
            this.categories = menu.categories ?? [];

            // --- COMPUTED ---
            this.tableComputed = this.ordersService.loadComputed() || {};

            for (const t of this.tables) {
              if (!this.tableComputed[t.tableId]) {
                this.tableComputed[t.tableId] = {
                  lastActionAt: '—',
                  lastAddedItem: '—',
                  total: 0,
                  currency: 'EUR',
                  itemCount: 0,
                  cssClass: this.miscService.getTableCss(t, this.waiterState)
                };
              }
            }

            // recalculăm cssClass pentru toate mesele
            Object.keys(this.tableComputed).forEach(tableId => {
              const entry = this.tableComputed[tableId];
              entry.cssClass = this.miscService.getTableCss(
                this.tables.find(t => t.tableId === tableId)!,
                this.waiterState
              );
            });

            // --- CARTS ---
            this.tableCarts = await this.offlineDB.loadAllCarts();

            // --- RESTORE CURRENT TABLE ---
            const savedTableId = localStorage.getItem('currentTableId');
            if (savedTableId) {
              const table = this.tables.find(t => t.tableId === savedTableId);
              if (table) this.openTable(table);
            }
          });

        // SEARCH
        this.search$
          .pipe(debounceTime(250))
          .subscribe(term => {
            if (!term.trim()) {
              this.filteredResults = [];
              return;
            }
            const results = this.fuse.search(term);
            this.filteredResults = results.map(r => r.item);
          });
      });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sseService.close();
  }
}
