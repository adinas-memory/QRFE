import { ButtonsComponent } from '../../../views/buttons/buttons/buttons.component';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import Fuse from 'fuse.js';
import { IconDirective } from '@coreui/icons-angular';
import { BadgeComponent, ButtonCloseDirective, ButtonDirective, CardBodyComponent, CardComponent, CardFooterComponent, CardGroupComponent, CardHeaderComponent, CardImgDirective, CardTextDirective, CardTitleDirective, ColComponent, ColDirective, DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, NavbarComponent, NavbarNavComponent, NavbarTogglerDirective, NavComponent, NavItemComponent, NavLinkDirective, OffcanvasBodyComponent, OffcanvasComponent, OffcanvasHeaderComponent, OffcanvasTitleDirective, OffcanvasToggleDirective, RowComponent, TableDirective, Tabs2Module, TemplateIdDirective, WidgetStatAComponent, WidgetStatFComponent } from '@coreui/angular';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { filter, Subject, take, takeUntil, debounceTime, forkJoin } from 'rxjs';
import { NgFor, NgIf, NgStyle, CurrencyPipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { cilBellExclamation } from '@coreui/icons';
import { UserContextModel } from '../../../core/models/userContextModel';
import { SnoozeWaiterCallEvent, WaiterCallEvent, WaiterCallState } from '../../../core/models/callWaiter/callWaiter';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { OrdersService } from '../../../core/services/order-service/orders.service';
import { OrderItemDTO, CartItem, TableCart, OrderDTO } from '../../../core/models/orderingModel';
import { OrderSyncService } from '../../../core/services/order-service/order-sync.service';

@Component({
  selector: 'app-manage-orders',
  imports:
    [RowComponent, Tabs2Module, FormsModule,
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
      NavLinkDirective
    ],
  styleUrls: ['./manage-orders.component.scss'],
  standalone: true,
  templateUrl: './manage-orders.component.html'
})


export class ManageOrdersComponent implements OnInit, OnDestroy {
  icons = { cilBellExclamation };
  private destroy$ = new Subject<void>();
  private restaurantId = '';
  private waiterCallSubscription: any;
  private snoozeWaiterCallSubscription: any;
  waiterState: Record<string, WaiterCallState> = {};
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


  constructor(private tablesService: TablesService, private menuItemService: MenuItemServiceService,
    private authService: AuthService, private ordersService: OrdersService,
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
      .subscribe(() => this.reloadOrder());
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
      .subscribe(() => this.reloadOrder());
  }


  private reloadOrder() {
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

        this.saveCart();
        this.orderIsConfirmed = order.orderItems.length > 0;
      });
  }



  confirmOrder() {
    this.ordersService
      .listOpenOrderForTable(this.restaurantId, this.currentTableId)
      .pipe(take(1))
      .subscribe(order => {
        if (!order) {
          this.createNewOrder();
        } else {
          this.updateExistingOrder(order);
        }
        this.orderIsConfirmed = true;
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
      // DRAFT MODE
      const cart = this.tableCarts[this.currentTableId];
      const existing = cart.find(x => x.item.menuItemId === item.menuItemId);

      if (existing) existing.quantity++;
      else cart.push({ item, quantity: 1 });

      this.saveCart();
      return;
    }

    // LIVE MODE → optimistic UI + batching
    const existing = this.selectedItems.find(x => x.item.menuItemId === item.menuItemId);

    if (!existing) {
      // UI optimistic: adaugăm itemul local
      this.tableCarts[this.currentTableId].push({
        item,
        quantity: 1,
        orderItemId: undefined
      });

      this.saveCart();

      // trimitem POST imediat (nu se poate batch-ui)
      this.ordersService.addOrderItem(
        this.restaurantId,
        this.currentTableId,
        this.currentOrderId!,
        item.menuItemId,
        1
      ).subscribe(() => this.reloadOrder());

      return;
    }

    // UI optimistic: creștem quantity local
    existing.quantity++;
    this.saveCart();

    // batching
    this.queueQuantityUpdate(existing);
  }



  decrementItem(sel: CartItem) {
    if (!this.orderIsConfirmed) {
      // DRAFT MODE
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

    // LIVE MODE → optimistic UI
    const existing = this.selectedItems.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    if (existing.quantity > 1) {
      existing.quantity--;
      this.saveCart();
      this.queueQuantityUpdate(existing);
    } else {
      // UI optimistic: scoatem itemul
      this.tableCarts[this.currentTableId] =
        this.tableCarts[this.currentTableId].filter(x => x.item.menuItemId !== sel.item.menuItemId);
      this.saveCart();

      // DELETE imediat (nu se poate batch-ui)
      this.ordersService.deleteOrderItem(
        this.restaurantId,
        this.currentTableId,
        this.currentOrderId!,
        existing.orderItemId!
      ).subscribe(() => this.reloadOrder());
    }
  }

  removeItem(sel: CartItem) {
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
    if (!existing) return;

    if (!this.orderIsConfirmed) {
      // DRAFT MODE
      this.tableCarts[this.currentTableId] =
        cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);

      this.saveCart();
      return;
    }

    // LIVE MODE
    this.ordersService.deleteOrderItem(
      this.restaurantId,
      this.currentTableId,
      this.currentOrderId!,
      existing.orderItemId!
    ).subscribe(() => this.reloadOrder());
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
    ).subscribe(() => this.reloadOrder());
  }

  openTable(table: TableDTO) {
    this.currentTableId = table.tableId;
    console.log('Opening table:', this.currentTableId);
    console.log('Table details:', table.tableName);
    this.tableName = table.tableName ?? '';
    if (!this.tableCarts[this.currentTableId]) {
      this.tableCarts[this.currentTableId] = [];
    }
    this.canvasVisible = true;
    // this.orderIsConfirmed = true;
    this.openOrder();
  }

  loadMenuItems(): void {
    this.menuItemService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.menuItems = response.menu?.menuItems ?? [];
          this.fuse = new Fuse(this.menuItems, {
            keys: ['menuItemName'],
            threshold: 0.3, // fuzzy level (0 exact, 1 very permisiv)
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
          this.tables = response,
            this.openTables = response.filter(t => t.isTableOpen);
          this.closedTables = response.filter(t => !t.isTableOpen);
        },
        error: err => console.error('[ManageTablesComponent] Error loading tables', err)
      });
  }

  snoozeWaiterCall(tableId: string): void {
    this.tablesService.snoozeWaiterCall(this.restaurantId, tableId)
      .pipe(take(1))
      .subscribe({
        next: () => {

        },
        error: (err: unknown) => console.error('Error snoozing waiter call', err)
      });
  }

  ngOnInit(): void {
    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1)
      )
      .subscribe(user => {
        this.restaurantId = user.restaurantId ?? '';
        this.loadTables();
        this.loadMenuItems();

        this.waiterCallSubscription = this.tablesService.listenForWaiterCall(this.restaurantId)
          .subscribe({
            next: (response: WaiterCallEvent) => {
              const tableId = response.Data.TableId;
              console.log('Received waiter call for tableId:', tableId);
              this.waiterState = { ...this.waiterState, [tableId]: WaiterCallState.Active };
            },
            error: (err: unknown) => console.error('SSE error:', err)
          });

        this.snoozeWaiterCallSubscription = this.tablesService.listenSnoozeWaiterCall(this.restaurantId)
          .subscribe({
            next: (response: SnoozeWaiterCallEvent) => {
              const tableId = response.Data.TableId;
              this.waiterState = { ...this.waiterState, [tableId]: WaiterCallState.Snoozed };
            },
            error: (err: unknown) => console.error('SSE error:', err)
          });
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

    const saved = localStorage.getItem('tableCarts');
    if (saved) {
      this.tableCarts = JSON.parse(saved);
    }

    this.quantityUpdate$
      .pipe(debounceTime(500))
      .subscribe(item => this.flushQuantityUpdate(item));
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.waiterCallSubscription?.unsubscribe();
    this.snoozeWaiterCallSubscription?.unsubscribe();
  }
}
