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
  WaiterCallState = WaiterCallState;

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
    lastActionTime: string;
    lastAddedItem: string;
    total: number;
    currency: string;
    itemCount: number;
    cssClass: string;
  }> = {};

  constructor(
    private tablesService: TablesService,
    private menuItemService: MenuItemServiceService,
    private ngZone: NgZone,
    private authService: AuthService,
    private ordersService: OrdersService,
    private sseService: OrderSyncService,
    private miscService: MiscellaneousService
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
      .subscribe(order => {
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
        this.saveCart();
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

  addCartItem(item: MenuItem) {
    if (!this.orderIsConfirmed) {
      const cart = this.tableCarts[this.currentTableId];
      const existing = cart.find(x => x.item.menuItemId === item.menuItemId);

      if (existing) existing.quantity++;
      else cart.push({ item, quantity: 1 });
      this.saveCart();
      return;
    }

    const existing = this.selectedItems.find(x => x.item.menuItemId === item.menuItemId);

    if (!existing) {
      this.tableCarts[this.currentTableId].push({
        item,
        quantity: 1,
        orderItemId: undefined
      });
      this.saveCart();

      this.ordersService.addOrderItem(
        this.restaurantId,
        this.currentTableId,
        this.currentOrderId!,
        item.menuItemId,
        1
      ).subscribe(() => { });
      return;
    }

    existing.quantity++;
    this.saveCart();
    this.queueQuantityUpdate(existing);
  }

  decrementItem(sel: CartItem) {
    if (!this.orderIsConfirmed) {
      const cart = this.tableCarts[this.currentTableId];
      const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
      if (!existing) return;

      if (existing.quantity > 1) {
        existing.quantity--;
      } else {
        this.tableCarts[this.currentTableId] =
          cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);
      }
      this.saveCart();
      return;
    }

    const existing = this.selectedItems.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    if (existing.quantity > 1) {
      existing.quantity--;
      this.saveCart();
      this.queueQuantityUpdate(existing);
    } else {
      this.tableCarts[this.currentTableId] =
        this.tableCarts[this.currentTableId].filter(x => x.item.menuItemId !== sel.item.menuItemId);
      this.saveCart();

      this.ordersService.deleteOrderItem(
        this.restaurantId,
        this.currentTableId,
        this.currentOrderId!,
        existing.orderItemId!
      )
        // CHANGED: nu mai chemăm reloadOrder, SSE va trimite OrderUpdated
        .subscribe(() => { });
    }
  }

  removeItem(sel: CartItem) {
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    if (!this.orderIsConfirmed) {
      this.tableCarts[this.currentTableId] =
        cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);

      this.saveCart();
      return;
    }

    this.ordersService.deleteOrderItem(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      existing.orderItemId!
    )
      // CHANGED: nu mai chemăm reloadOrder, SSE va trimite OrderUpdated
      .subscribe(() => { });
  }

  private queueQuantityUpdate(item: CartItem) {
    this.quantityBuffer[item.orderItemId!] = item.quantity;
    this.quantityUpdate$.next(item);
  }

  private flushQuantityUpdate(item: CartItem) {
    const finalQuantity = this.quantityBuffer[item.orderItemId!];
    if (finalQuantity == null) return;

    delete this.quantityBuffer[item.orderItemId!];

    this.ordersService.updateOrderItemQuantity(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      item.orderItemId!,
      finalQuantity
    )
      // CHANGED: nu mai chemăm reloadOrder, SSE va trimite OrderUpdated
      .subscribe(() => { });
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
      .subscribe(order => {

        if (order) {
          this.orderIsConfirmed = true;
          this.currentOrderId = order.orderId;

          this.tableCarts[this.currentTableId] = order.orderItems!.map(o => ({
            item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
            quantity: o?.quantity ?? 0,
            orderItemId: o?.orderItemId
          }));

          this.saveCart();
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

  saveCart() {
    localStorage.setItem('tableCarts', JSON.stringify(this.tableCarts));
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

  moveCartToSelectedTable() {
    if (!this.selectedTargetTableId) return;

    const sourceId = this.currentTableId;
    const targetId = this.selectedTargetTableId;

    if (!this.tableCarts[sourceId]) return;

    this.tableCarts[targetId] = this.tableCarts[sourceId];
    delete this.tableCarts[sourceId];

    this.saveCart();

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

  confirmCloseOrder() {
    this.showCloseConfirm = false;

    this.ordersService.closeOrder(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!
    ).subscribe({
      next: (response: OrderDTO) => {
        this.tableCarts[this.currentTableId] = [];
        this.ordersService.removeComputed();
        this.tableComputed = {};
        localStorage.removeItem('currentTableId');
        this.markTableAsOpen(this.currentTableId);
        localStorage.removeItem('tableCarts');
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

  startSse() {
    this.sseService.listenToRestaurantEvents(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ EventType, Data }) => {

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
                this.waiterState,
                d => this.miscService.getLastActionTime(d)
              );

            this.ordersService.saveComputed(this.tableComputed);
            this.saveCart();
            break;
          }

          case 'OrderClosedWithPayment':
            this.markTableAsOpen(Data.TableId);
            if (this.currentTableId === Data.TableId) {
              this.orderIsConfirmed = false;
              this.currentOrderId = null;
              this.tableCarts[Data.TableId] = [];
              this.saveCart();
            }
            break;

          case 'TablesStatusesUpdate': {
            const computedList = Data as TableComputedDTO[];

            // CHANGED: statusul meselor se bazează acum pe SSE
            this.tables = this.tables.map(t => {
              const c = computedList.find(x => x.tableId === t.tableId);
              return c ? { ...t, isTableOpen: c.isTableOpen } : t;
            });
            this.refreshTableLists();

            this.tableComputed = {};
            computedList.forEach(c => {
              const table = this.tables.find(t => t.tableId === c.tableId);
              if (!table) return;

              this.tableComputed[c.tableId] =
                this.ordersService.mapTableToComputed(
                  table,
                  this.waiterState,
                  c,
                  d => this.miscService.getLastActionTime(d)
                );
            });

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

      });
  }

  getTableCss(table: TableDTO, waiterState: Record<string, WaiterCallState>): string {
    return this.miscService.getTableCss(table, waiterState);
  }

  ngOnInit(): void {
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
          .subscribe(({ tables, menu }) => {

            this.tables = tables;
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

            const savedCarts = localStorage.getItem('tableCarts');
            if (savedCarts) {
              this.tableCarts = JSON.parse(savedCarts);
            }

            const savedTableId = localStorage.getItem('currentTableId');
            if (savedTableId) {
              const table = this.tables.find(t => t.tableId === savedTableId);
              if (table) this.openTable(table);
            }

            this.startSse();
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
          .subscribe(item => this.flushQuantityUpdate(item));
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
