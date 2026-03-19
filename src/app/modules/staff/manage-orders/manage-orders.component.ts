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
import { filter, Subject, take, takeUntil, debounceTime, forkJoin } from 'rxjs';
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
  private quantityBuffer: Record<string, number> = {};
  private quantityUpdate$ = new Subject<CartItem>();
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
    private offlineDB: OfflineDbService
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

  async saveCartFor(tableId: string) {
    const items = this.tableCarts[tableId] ?? [];
    await this.offlineDB.saveCart(tableId, items);
  }

  openOrder() {
    this.ordersService.listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(order => {
        if (!order) {
          this.createNewOrder();
          return;
        }
      });
  }

  private createNewOrder() {
    this.ordersService.newOrder(
      this.restaurantId,
      this.currentTableId,
      this.seatId ?? undefined
    )
      .pipe(take(1))
      .subscribe(() => { });
  }

  private updateExistingOrder(order: OrderDTO) {
    const updatedItems = this.selectedItems.map(ci => ({
      menuItemId: ci.item.menuItemId,
      quantity: ci.quantity
    }));

    this.ordersService.updateOrderItem(
      this.restaurantId,
      this.currentTableId,
      order.orderId,
      {
        orderItems: updatedItems,
        seatId: null
      }
    ).pipe(take(1))
      // CHANGED: nu mai chemăm reloadOrder, ne bazăm pe SSE OrderUpdated
      .subscribe(() => { });
  }

  private reloadOrder() {
    // OPTIONAL: poți păstra ca fallback manual, dar nu îl mai apela automat
    this.ordersService.listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(async order => {
        if (!order || !order.orderItems) return;

        this.currentOrderId = order.orderId;

        this.tableCarts[this.currentTableId] = order.orderItems
          .filter(o => o != null)
          .map(o => ({
            item: this.menuItems.find(m => m.menuItemId === o.menuItemId)!,
            quantity: o.quantity ?? 0,
            orderItemId: o.orderItemId ?? undefined
          }));

        this.orderIsConfirmed = true;
        await this.saveCartFor(this.currentTableId);
      });
  }

  confirmOrder() {
    this.ordersService
      .listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(order => {

        if (!order) {
          this.ordersService.newOrder(
            this.restaurantId,
            this.currentTableId,
            this.seatId ?? undefined
          )
            .pipe(take(1))
            .subscribe(newOrder => {

              this.currentOrderId = newOrder.order.orderId;

              const items = this.tableCarts[this.currentTableId].map(ci => ({
                menuItemId: ci.item.menuItemId,
                quantity: ci.quantity
              }));

              this.ordersService.updateOrderItem(
                this.restaurantId,
                this.currentTableId,
                this.currentOrderId,
                { orderItems: items, seatId: null }
              )
                .pipe(take(1))
                // CHANGED: nu mai chemăm reloadOrder, SSE va trimite OrderUpdated
                .subscribe(() => {
                  this.orderIsConfirmed = true;
                  this.markTableAsClosed(this.currentTableId);
                });
            });

          return;
        }

        this.updateExistingOrder(order);
        this.currentOrderId = order.orderId;
        this.orderIsConfirmed = true;
        this.markTableAsClosed(this.currentTableId);
      });
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
    // UI update instant
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);
    console.log('[addCartItem] navigator.onLine =', navigator.onLine);
    console.log('[addCartItem] orderIsConfirmed =', this.orderIsConfirmed);


    // Dacă itemul există deja
    if (existing) {
      existing.quantity++;
      await this.saveCartFor(this.currentTableId);

      // Dacă comanda nu e confirmată → ne oprim aici
      if (!this.orderIsConfirmed) return;

      // Dacă suntem offline → punem UPDATE_QUANTITY în coadă
      if (!navigator.onLine) {
        console.log('[addCartItem] OFFLINE → ADD_ITEM queued');
        await this.offlineDB.addOfflineAction({
          type: 'UPDATE_QUANTITY',
          restaurantId: this.restaurantId,
          tableId: this.currentTableId,
          orderId: this.currentOrderId!,
          payload: {
            orderItemId: existing.orderItemId!,
            quantity: existing.quantity
          }
        });
        console.log('[addCartItem] existing item → UPDATE_QUANTITY');
        return;
      }

      // Dacă suntem online → folosim fluxul normal
      console.log('[addCartItem] ONLINE → ADD_ITEM sent to server');
      this.queueQuantityUpdate(existing);
      return;
    }

    // Dacă itemul NU există în cart
    cart.push({ item, quantity: 1, orderItemId: undefined });
    await this.saveCartFor(this.currentTableId);

    // Dacă comanda nu e confirmată → ne oprim aici
    if (!this.orderIsConfirmed) return;

    // Dacă suntem offline → punem ADD_ITEM în coadă
    if (!navigator.onLine) {
      await this.offlineDB.addOfflineAction({
        type: 'ADD_ITEM',
        restaurantId: this.restaurantId,
        tableId: this.currentTableId,
        orderId: this.currentOrderId!,
        payload: { menuItemId: item.menuItemId, quantity: 1 }
      });


      return;
    }

    // Dacă suntem online → trimitem direct
    this.ordersService.addOrderItem(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      item.menuItemId,
      1
    ).subscribe(() => { });
  }


  async decrementItem(sel: CartItem) {
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    // 1) UI update instant
    if (existing.quantity > 1) {
      existing.quantity--;
    } else {
      this.tableCarts[this.currentTableId] =
        cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);
    }

    await this.saveCartFor(this.currentTableId);

    // 2) Dacă nu e confirmată comanda → doar local, nimic la server
    if (!this.orderIsConfirmed) return;

    // 3) Dacă suntem offline → punem în coadă
    if (!navigator.onLine) {
      if (existing.quantity > 0) {
        // UPDATE_QUANTITY
        await this.offlineDB.addOfflineAction({
          type: 'UPDATE_QUANTITY',
          restaurantId: this.restaurantId,
          tableId: this.currentTableId,
          orderId: this.currentOrderId!,
          payload: {
            orderItemId: existing.orderItemId!,
            quantity: existing.quantity
          }
        });
      } else {
        // DELETE_ITEM
        await this.offlineDB.addOfflineAction({
          type: 'DELETE_ITEM',
          restaurantId: this.restaurantId,
          tableId: this.currentTableId,
          orderId: this.currentOrderId!,
          payload: { orderItemId: existing.orderItemId }
        });
      }
      return;
    }

    // 4) Dacă suntem online → trimitem normal
    if (existing.quantity > 0) {
      this.queueQuantityUpdate(existing);
    } else {
      this.ordersService.deleteOrderItem(
        this.restaurantId,
        this.currentTableId,
        this.currentOrderId!,
        existing.orderItemId!
      ).subscribe(() => { });
    }
  }


  async removeItem(sel: CartItem) {
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    // UI update instant
    this.tableCarts[this.currentTableId] =
      cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);

    await this.saveCartFor(this.currentTableId);
    // OFFLINE → punem în coadă
    if (!navigator.onLine) {
      await this.offlineDB.addOfflineAction({
        type: 'DELETE_ITEM',
        restaurantId: this.restaurantId,
        tableId: this.currentTableId,
        orderId: this.currentOrderId!,
        payload: { orderItemId: existing.orderItemId }
      });


      return;
    }
    // ONLINE → trimitem direct
    this.ordersService.deleteOrderItem(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      existing.orderItemId!
    ).subscribe(() => { });
  }

  private queueQuantityUpdate(item: CartItem) {
    this.quantityBuffer[item.orderItemId!] = item.quantity;
    this.quantityUpdate$.next(item);
  }

  private async flushQuantityUpdate(item: CartItem) {

    // 🔥 1. Dacă orderul e închis → ignorăm complet
    if (!this.orderIsConfirmed || !this.currentOrderId) {
      console.log('[flushQuantityUpdate] Ignored because order is closed');
      return;
    }

    const finalQuantity = this.quantityBuffer[item.orderItemId!];
    if (finalQuantity == null) return;

    delete this.quantityBuffer[item.orderItemId!];

    await this.saveCartFor(this.currentTableId);

    if (!navigator.onLine) {
      await this.offlineDB.addOfflineAction({
        type: 'UPDATE_QUANTITY',
        restaurantId: this.restaurantId,
        tableId: this.currentTableId,
        orderId: this.currentOrderId!,
        payload: {
          orderItemId: item.orderItemId!,
          quantity: finalQuantity
        }
      });
      return;
    }

    this.ordersService.updateOrderItemQuantity(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      item.orderItemId!,
      finalQuantity
    ).subscribe(() => { });
  }

  openTable(table: TableDTO) {
    this.currentTableId = table.tableId;
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    localStorage.setItem('currentTableId', this.currentTableId);

    if (!this.tableCarts[this.currentTableId]) {
      this.tableCarts[this.currentTableId] = [];
    }

    this.ordersService.listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(async order => {

        if (order) {
          this.orderIsConfirmed = true;
          this.currentOrderId = order.orderId;

          this.tableCarts[this.currentTableId] = order.orderItems!.map(o => ({
            item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
            quantity: o?.quantity ?? 0,
            orderItemId: o?.orderItemId
          }));

          await this.saveCartFor(this.currentTableId);
          return;
        }

        this.orderIsConfirmed = false;
        this.currentOrderId = null;

        if (!this.tableCarts[this.currentTableId]) {
          this.tableCarts[this.currentTableId] = [];
        }
      });
  }

  loadMenuItems(): void {
    this.menuItemService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.menuItems = response.menu?.menuItems ?? [];
          this.fuse = new Fuse(this.menuItems, {
            keys: ['menuItemName'],
            threshold: 0.3,
          });
          this.categories = response.categories ?? [];
        },
        error: err => console.error('[MenuComponent] Error loading menu items', err)
      });
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

  seeOrder(table: TableDTO) {
    this.currentTableId = table.tableId;
    localStorage.setItem('currentTableId', this.currentTableId);
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    this.ordersService.listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(order => {
        if (order) {
          this.currentOrderId = order.orderId;
          this.orderIsConfirmed = true;

          this.tableCarts[this.currentTableId] = order.orderItems!.map(o => ({
            item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
            quantity: o?.quantity ?? 0,
            orderItemId: o?.orderItemId
          }));
        }
      });
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

    await this.saveCartFor(targetId);

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
    this.showCloseConfirm = false;

    // 1. Oprim orice update întârziat
    this.quantityBuffer = {};
    this.quantityUpdate$.complete();
    this.quantityUpdate$ = new Subject<CartItem>(); // recreăm pentru următoarea comandă

    // 2. Ștergem acțiunile offline pentru acest order
    if (this.currentOrderId) {
      await this.offlineDB.deleteActionsForOrder(this.currentOrderId);
    }

    // 3. UI update imediat
    this.tableCarts[this.currentTableId] = [];
    delete this.tableComputed[this.currentTableId];
    localStorage.removeItem('currentTableId');
    this.markTableAsOpen(this.currentTableId);

    await this.offlineDB.deleteCart(this.currentTableId);

    const tableId = this.currentTableId;
    const orderId = this.currentOrderId!;

    // OFFLINE → punem în coadă
    if (!navigator.onLine) {
      await this.offlineDB.addOfflineAction({
        type: 'CLOSE_ORDER',
        restaurantId: this.restaurantId,
        tableId,
        orderId,
        payload: {}
      });

      // reset UI
      this.currentTableId = '';
      this.tableName = '';
      this.orderIsConfirmed = false;
      this.canvasVisible = false;

      return;
    }

    // ONLINE → trimitem direct
    this.ordersService.closeOrder(
      this.restaurantId,
      tableId,
      orderId
    ).subscribe({
      next: async () => {
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

      case 'NewOrderPrivateEvent':
        this.markTableAsClosed(Data.TableId);
        break;

      case 'OrderUpdated': {
        const payload = Data as OrderUpdatedSSEPayload;

        this.tableCarts[payload.TableId] =
          this.ordersService.mapPayloadItemsToCart(payload.Items, this.menuItems);

        this.tableComputed[payload.TableId] =
          this.ordersService.mapPayloadToComputed(
            payload,
            this.tables,
            this.waiterState
          );

        this.ordersService.saveComputed(this.tableComputed);
        await this.saveCartFor(this.currentTableId);
        break;
      }

      case 'OrderClosedWithPayment':
        this.markTableAsOpen(Data.TableId);
        if (this.currentTableId === Data.TableId) {
          this.orderIsConfirmed = false;
          this.currentOrderId = null;
          this.tableCarts[Data.TableId] = [];
          await this.saveCartFor(Data.TableId);
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
          tables: this.tablesService.getAll(this.restaurantId).pipe(take(1)),
          menu: this.menuItemService.getAll(this.restaurantId).pipe(take(1))
        })
          .subscribe(async ({ tables, menu }) => {
            console.log('Initial data loaded', { tables, menu });

            this.tables = tables;
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

            this.menuItems = menu.menu.menuItems ?? [];
            this.categories = menu.categories ?? [];
            this.refreshTableLists();
            this.tableComputed = this.ordersService.loadComputed() || {};

            Object.keys(this.tableComputed).forEach(tableId => {
              const entry = this.tableComputed[tableId];
              entry.cssClass = this.miscService.getTableCss(
                this.tables.find(t => t.tableId === tableId)!,
                this.waiterState
              );
            });

            await this.offlineDB.loadAllCarts().then(carts => {
              this.tableCarts = carts;
            });

            const savedTableId = localStorage.getItem('currentTableId');
            if (savedTableId) {
              const table = this.tables.find(t => t.tableId === savedTableId);
              if (table) this.openTable(table);
            }

          });

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

        this.quantityUpdate$
          .pipe(debounceTime(500))
          .subscribe(item => {
            this.flushQuantityUpdate(item);
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sseService.close();
  }
}
