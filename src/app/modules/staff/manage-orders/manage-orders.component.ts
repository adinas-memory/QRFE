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


  async openOrder() {
    const order = await this.ordersService.listOpenOrderForTableWithFallback(this.restaurantId, this.currentTableId);

    if (!order) {
      this.createNewOrder();
      return;
    }
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

  async confirmOrder() {
    if (document.hidden) {
      console.log('[CONFIRM] Tab hidden → skip confirmOrder');
      return;
    }

    //  1. PRIMA verificare: suntem offline?
    if (!(await this.miscService.isReallyOnline())) {
      const localOrderId = 'local-' + crypto.randomUUID();

      this.currentOrderId = localOrderId;
      this.orderIsConfirmed = true;

      const cart = await this.offlineDB.loadCart(this.currentTableId);
      // 1. NEW_ORDER
      await this.offlineDB.addOfflineAction({
        type: 'NEW_ORDER',
        restaurantId: this.restaurantId,
        tableId: this.currentTableId,
        orderId: localOrderId,
        payload: { seatId: this.seatId ?? null }
      });
      // 2. INIT_ORDER_ITEMS
      await this.offlineDB.addOfflineAction({
        type: 'INIT_ORDER_ITEMS_FINAL',
        restaurantId: this.restaurantId,
        tableId: this.currentTableId,
        orderId: localOrderId,
        payload: {
          orderItems: cart.map(ci => ({
            menuItemId: ci.item.menuItemId,
            quantity: ci.quantity
          })),
          seatId: null
        }
      });

      this.markTableAsClosed(this.currentTableId);
      this.updateComputedLocal(this.currentTableId);
      return;
    }

    //  2. Suntem online → verificăm dacă există order
    const order = await this.ordersService.listOpenOrderForTableWithFallback(
      this.restaurantId,
      this.currentTableId
    );

    if (!order) {
      const cart = await this.offlineDB.loadCart(this.currentTableId);
      //  3. Online + fără order → creăm unul real
      this.ordersService.newOrder(
        this.restaurantId,
        this.currentTableId,
        this.seatId ?? undefined
      )
        .pipe(take(1))
        .subscribe(async newOrder => {

          this.currentOrderId = newOrder.order.orderId;

          const body = {
            orderItems: cart.map(ci => ({
              menuItemId: ci.item.menuItemId,
              quantity: ci.quantity
            })),
            seatId: null
          };

          this.ordersService.updateOrderItem(
            this.restaurantId,
            this.currentTableId,
            this.currentOrderId,
            { orderItems: body.orderItems, seatId: null }
          )
            .pipe(take(1))
            .subscribe(async () => {
              this.orderIsConfirmed = true;
              this.markTableAsClosed(this.currentTableId);
              //  2. Salvăm în Dexie orderId + items
              await this.offlineDB.saveCart(
                this.currentTableId,
                this.tableCarts[this.currentTableId],
                this.currentOrderId ?? ''
              );
            });
        });

      return;
    }

    // 4. Online + order existent → update
    this.updateExistingOrder(order);
    this.currentOrderId = order.orderId;
    this.orderIsConfirmed = true;
    this.markTableAsClosed(this.currentTableId);
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
    if (document.hidden) {
      console.log('[CONFIRM] Tab hidden → skip confirmOrder');
      return;
    }
    // UI update instant
    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);

    // Dacă itemul există deja
    if (existing) {
      existing.quantity++;
      await this.offlineDB.saveCart(
        this.currentTableId,
        this.tableCarts[this.currentTableId],
        this.currentOrderId ?? undefined
      );

      // Dacă comanda nu e confirmată → ne oprim aici
      if (!this.orderIsConfirmed) return;

      // Dacă suntem offline → punem UPDATE_QUANTITY în coadă
      if (!(await this.miscService.isReallyOnline())) {
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
    await this.offlineDB.saveCart(
      this.currentTableId,
      this.tableCarts[this.currentTableId],
      this.currentOrderId ?? undefined
    );
    // Dacă comanda nu e confirmată → ne oprim aici
    if (!this.orderIsConfirmed) return;

    // Dacă suntem offline → punem ADD_ITEM în coadă
    if (!(await this.miscService.isReallyOnline())) {
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
    ).subscribe(resp => {
      const cart = this.tableCarts[this.currentTableId];
      const added = cart.find(i => i.item.menuItemId === resp.menuItemId);
      if (added) {
        added.orderItemId = resp.orderItemId;
      }

      this.offlineDB.saveCart(
        this.currentTableId,
        cart,
        resp.orderId
      );
    });
  }

  updateComputedLocal(tableId: string) {
    const cart = this.tableCarts[tableId] ?? [];

    this.tableComputed[tableId] = {
      lastActionAt: new Date().toISOString(),
      lastAddedItem: cart.length ? cart[cart.length - 1].item.menuItemName : '—',
      total: cart.reduce((s, c) => s + c.item.menuItemPriceAmount * c.quantity, 0),
      currency: cart[0]?.item.menuItemPriceCurrency ?? 'EUR',
      itemCount: cart.reduce((s, c) => s + c.quantity, 0),
      cssClass: this.miscService.getTableCss(
        this.tables.find(t => t.tableId === tableId)!,
        this.waiterState
      )
    };

    this.ordersService.saveComputed(this.tableComputed);
  }


  async decrementItem(sel: CartItem) {
    if (document.hidden) {
      console.log('[CONFIRM] Tab hidden → skip confirmOrder');
      return;
    }
    const tableId = this.currentTableId;
    const existing = this.tableCarts[tableId].find(
      x => x.item.menuItemId === sel.item.menuItemId
    );
    if (!existing) return;

    // UI update trebuie să se întâmple ÎNAINTE de orice return
    if (existing.quantity > 1) {
      existing.quantity--;
    } else {
      existing.quantity = 0;
      this.tableCarts[tableId] = this.tableCarts[tableId].filter(i => i !== existing);
    }
    await this.offlineDB.saveCart(
      this.currentTableId,
      this.tableCarts[this.currentTableId],
      this.currentOrderId ?? undefined
    );

    // 🔥 Dacă orderId este local → doar local, fără queue
    if (this.currentOrderId?.startsWith('local-')) {
      console.log('[decrementItem] Local order → local only');
      return;
    }

    // 1) Order NEconfirmat → doar local
    if (!this.orderIsConfirmed || !this.currentOrderId) return;

    // 2) Confirmat dar fără orderItemId încă
    if (!existing.orderItemId) {
      console.warn('[decrementItem] Confirmed order but no orderItemId yet → wait for SSE');
      return;
    }

    const orderId = this.currentOrderId;
    const orderItemId = existing.orderItemId;

    // 3) OFFLINE → queue
    if (!(await this.miscService.isReallyOnline())) {
      if (existing.quantity > 0) {
        await this.offlineDB.addOfflineAction({
          type: 'UPDATE_QUANTITY',
          restaurantId: this.restaurantId,
          tableId,
          orderId,
          payload: { orderItemId, quantity: existing.quantity }
        });
      } else {
        await this.offlineDB.addOfflineAction({
          type: 'DELETE_ITEM',
          restaurantId: this.restaurantId,
          tableId,
          orderId,
          payload: { orderItemId, menuItemId: existing.item.menuItemId, quantity: existing.quantity }
        });
      }
      return;
    }

    // 4) ONLINE → HTTP
    if (existing.quantity > 0) {
      this.queueQuantityUpdate(existing);
    } else {
      this.ordersService.deleteOrderItem(
        this.restaurantId,
        tableId,
        orderId,
        orderItemId
      ).subscribe(() => { });
    }
  }

  async removeItem(sel: CartItem) {
    if (document.hidden) {
      console.log('[CONFIRM] Tab hidden → skip confirmOrder');
      return;
    }
    const tableId = this.currentTableId;
    const existing = this.tableCarts[tableId].find(
      x => x.item.menuItemId === sel.item.menuItemId
    );
    if (!existing) return;

    // Dacă orderId este local → tratăm ca NEconfirmat
    if (this.currentOrderId?.startsWith('local-')) {
      console.log('[removeItem] Local order → treat as unconfirmed');
      this.tableCarts[tableId] = this.tableCarts[tableId].filter(i => i !== existing);
      await this.offlineDB.saveCart(
        this.currentTableId,
        this.tableCarts[this.currentTableId],
        this.currentOrderId ?? undefined
      );
      return;
    }

    // 1) Order NEconfirmat → doar local
    if (!this.orderIsConfirmed || !this.currentOrderId) {
      console.log('[removeItem] Unconfirmed order → local delete');
      this.tableCarts[tableId] = this.tableCarts[tableId].filter(i => i !== existing);
      delete this.tableComputed[tableId];
      await this.offlineDB.saveCart(
        this.currentTableId,
        this.tableCarts[this.currentTableId],
        this.currentOrderId ?? undefined
      );
      return;
    }
    // 2) Order confirmat, dar itemul NU are încă orderItemId (SSE nu a venit)
    if (!existing.orderItemId) {
      console.warn('[removeItem] Confirmed order but no orderItemId yet → wait for SSE');
      return;
    }

    const orderId = this.currentOrderId;
    const orderItemId = existing.orderItemId;

    // 3) Order confirmat + OFFLINE → queue + local
    if (!(await this.miscService.isReallyOnline())) {
      console.log('[removeItem] Confirmed order + OFFLINE → queue DELETE_ITEM');

      this.tableCarts[tableId] = this.tableCarts[tableId].filter(i => i !== existing);
      delete this.tableComputed[tableId];
      await this.offlineDB.saveCart(
        this.currentTableId,
        this.tableCarts[this.currentTableId],
        this.currentOrderId ?? undefined
      );

      await this.offlineDB.addOfflineAction({
        type: 'DELETE_ITEM',
        restaurantId: this.restaurantId,
        tableId,
        orderId,
        payload: { orderItemId, menuItemId: existing.item.menuItemId }
      });

      return;
    }
    // 4) Order confirmat + ONLINE → HTTP DELETE
    console.log('[removeItem] Confirmed order + ONLINE → HTTP DELETE_ITEM');

    this.ordersService.deleteOrderItem(
      this.restaurantId,
      tableId,
      orderId,
      orderItemId
    ).subscribe({
      next: async () => {
        this.tableCarts[tableId] = this.tableCarts[tableId].filter(i => i !== existing);
        delete this.tableComputed[tableId];
        await this.offlineDB.saveCart(
          this.currentTableId,
          this.tableCarts[this.currentTableId],
          this.currentOrderId ?? undefined
        );
      },
      error: err => console.error('Error deleting item:', err)
    });
  }



  // async removeItem(sel: CartItem) {
  //   const cart = this.tableCarts[this.currentTableId];
  //   const existing = cart.find(x => x.item.menuItemId === sel.item.menuItemId);
  //   if (!existing) return;

  //   // UI update instant
  //   this.tableCarts[this.currentTableId] =
  //     cart.filter(x => x.item.menuItemId !== sel.item.menuItemId);

  //   await this.saveCartFor(this.currentTableId);
  //   // OFFLINE → punem în coadă
  //   if (!navigator.onLine) {
  //     await this.offlineDB.addOfflineAction({
  //       type: 'DELETE_ITEM',
  //       restaurantId: this.restaurantId,
  //       tableId: this.currentTableId,
  //       orderId: this.currentOrderId!,
  //       payload: { orderItemId: existing.orderItemId }
  //     });


  //     return;
  //   }
  //   // ONLINE → trimitem direct
  //   this.ordersService.deleteOrderItem(
  //     this.restaurantId,
  //     this.currentTableId,
  //     this.currentOrderId!,
  //     existing.orderItemId!
  //   ).subscribe(() => { });
  // }

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

    await this.offlineDB.saveCart(
      this.currentTableId,
      this.tableCarts[this.currentTableId],
      this.currentOrderId ?? undefined
    );

    if (!(await this.miscService.isReallyOnline())) {
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

  async openTable(table: TableDTO) {
    const tableId = table.tableId;
    this.currentTableId = tableId;
    this.tableName = table.tableName ?? '';
    this.canvasVisible = true;

    localStorage.setItem('currentTableId', tableId);

    if (!this.tableCarts[tableId]) {
      this.tableCarts[tableId] = [];
    }

    // 1. order local → doar Dexie
    if (this.currentOrderId?.startsWith('local-')) {
      this.tableCarts[tableId] = await this.offlineDB.loadCart(tableId);
      this.orderIsConfirmed = true;
      return;
    }

    // 2. order real
    const order = await this.ordersService.listOpenOrderForTableWithFallback(
      this.restaurantId,
      tableId
    );

    if (order) {
      this.orderIsConfirmed = true;
      this.currentOrderId = order.orderId;

      this.tableCarts[tableId] = order.orderItems!.map(o => ({
        item: this.menuItems.find(m => m.menuItemId === o?.menuItemId)!,
        quantity: o?.quantity ?? 0,
        orderItemId: o?.orderItemId
      }));

      await this.offlineDB.saveCart(
        this.currentTableId,
        this.tableCarts[this.currentTableId],
        this.currentOrderId ?? undefined
      );
      return;
    }

    // 3. masa fără order
    this.orderIsConfirmed = false;
    this.currentOrderId = null;
    await this.offlineDB.deleteCart(tableId);
    this.tableCarts[tableId] = [];
  }


  // loadMenuItems(): void {
  //   this.offlineDB.menuItems.toArray()
  //     .then(menuItems => {
  //       this.menuItems = menuItems;

  //       this.fuse = new Fuse(this.menuItems, {
  //         keys: ['menuItemName'],
  //         threshold: 0.3,
  //       });

  //       this.categories = [...new Set(menuItems.map(i => i.category))];
  //     })
  //     .catch(err => console.error('[MenuComponent] Error loading menu items from Dexie', err));
  // }


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

    // 1. Oprim orice update întârziat
    this.quantityBuffer = {};
    this.quantityUpdate$.complete();
    this.quantityUpdate$ = new Subject<CartItem>();

    const tableId = this.currentTableId;
    const orderId = this.currentOrderId!;

    // 3. OFFLINE → punem în coadă
    if (!(await this.miscService.isReallyOnline())) {
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

        // 1. Luăm cart-ul local
        const cart = this.tableCarts[tableId] ?? [];

        // 2. Injectăm orderItemId în itemele existente
        for (const sseItem of payload.Items) {
          const localItem = cart.find(ci => ci.item.menuItemId === sseItem.MenuItemId);
          if (localItem) {
            localItem.orderItemId = sseItem.OrderItemId;
          }
        }

        // 3. Actualizăm computed
        this.tableComputed[tableId] =
          this.ordersService.mapPayloadToComputed(
            payload,
            this.tables,
            this.waiterState
          );

        // 4. Salvăm în Dexie (fără să stricăm offline)
        await this.offlineDB.saveCart(
          tableId,
          cart,
          payload.OrderId
        );

        // 5. Reîncărcăm cart-ul din Dexie → UI devine 100% corect
        this.tableCarts[tableId] = await this.offlineDB.loadCart(tableId);

        break;
      }


      case 'OrderClosedWithPayment':
        console.log('Order closed event received', Data);
        const tableId = Data.TableId;
        await this.offlineDB.deleteCart(tableId);
        this.tableCarts[tableId] = [];
        delete this.tableComputed[tableId];
        this.markTableAsOpen(tableId);
        if (this.currentTableId === tableId) {
          this.orderIsConfirmed = false;
          this.canvasVisible = false;
          this.currentTableId = '';
          this.tableName = '';
          // this.currentOrderId = null;
          this.tableCarts[tableId] = [];
          delete this.tableComputed[this.currentTableId];
          // localStorage.removeItem('currentTableId');
          await this.offlineDB.deleteCart(this.currentTableId);
        }

        break;

      case 'TablesStatusesUpdate': {
        const computedList = Data as TableComputedDTO[];
        localStorage.setItem('tablesSnapshot', JSON.stringify(this.tables));
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

        // QUANTITY UPDATE
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
