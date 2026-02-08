import { ButtonsComponent } from '../../../views/buttons/buttons/buttons.component';
import { FormsModule } from '@angular/forms';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import Fuse from 'fuse.js';
import { IconDirective } from '@coreui/icons-angular';
import { BadgeComponent, ButtonCloseDirective, ButtonDirective, CardBodyComponent, CardComponent, CardFooterComponent, CardGroupComponent, CardHeaderComponent, CardImgDirective, CardTextDirective, CardTitleDirective, ColComponent, ColDirective, DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, NavbarComponent, NavbarNavComponent, NavbarTogglerDirective, NavComponent, NavItemComponent, NavLinkDirective, OffcanvasBodyComponent, OffcanvasComponent, OffcanvasHeaderComponent, OffcanvasTitleDirective, OffcanvasToggleDirective, RowComponent, TableDirective, Tabs2Module, TemplateIdDirective, WidgetStatAComponent, WidgetStatFComponent } from '@coreui/angular';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { filter, Subject, take, takeUntil, debounceTime } from 'rxjs';
import { NgFor, NgIf, NgStyle, CurrencyPipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { cilBellExclamation } from '@coreui/icons';
import { UserContextModel } from '../../../core/models/userContextModel';
import { SnoozeWaiterCallEvent, WaiterCallEvent, WaiterCallState } from '../../../core/models/callWaiter/callWaiter';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { OrdersService } from '../../../core/services/order-service/orders.service';

type CartItem = { item: MenuItem; qty: number };
type TableCart = { [tableId: string]: CartItem[] };
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
      NavComponent,
      NavItemComponent,
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
  tables: TableDTO[] = [];
  openTables: TableDTO[] = [];
  closedTables: TableDTO[] = [];
  subTotal: number = 0;
  searchTerm: string = '';
  search$ = new Subject<string>();
  filteredResults: MenuItem[] = [];
  private fuse!: Fuse<MenuItem>;




  constructor(private tablesService: TablesService, private menuItemService: MenuItemServiceService,
    private authService: AuthService, private ordersService: OrdersService
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

  get cartSubTotal(): number {
    const cart = this.tableCarts[this.currentTableId] ?? [];
    return cart.reduce((sum, sel) =>
      sum + sel.item.menuItemPriceAmount * sel.qty, 0
    );
  }

  get cartCurrency(): string | undefined {
    const cart = this.tableCarts[this.currentTableId] ?? [];
    return cart.length > 0 ? cart[0].item.menuItemPriceCurrency : undefined;
  }


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

  addCartItem(item: MenuItem) {
    if (!this.tableCarts[this.currentTableId]) {
      this.tableCarts[this.currentTableId] = [];
    }

    const cart = this.tableCarts[this.currentTableId];
    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);

    if (existing) {
      existing.qty++;
    } else {
      cart.push({ item, qty: 1 });
    }

    this.saveCart();
  }

  removeCartItem(item: MenuItem) {
    const cart = this.tableCarts[this.currentTableId];
    if (!cart) return;

    const existing = cart.find(x => x.item.menuItemId === item.menuItemId);
    if (!existing) return;

    if (existing.qty > 1) {
      existing.qty--;
    } else {
      this.tableCarts[this.currentTableId] = cart.filter(
        x => x.item.menuItemId !== item.menuItemId
      );
    }

    this.saveCart();
  }

  removeItemCompletely(item: MenuItem) {
    const cart = this.tableCarts[this.currentTableId];
    if (!cart) return;

    this.tableCarts[this.currentTableId] = cart.filter(
      x => x.item.menuItemId !== item.menuItemId
    );

    this.saveCart();
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
    // below code on submit order
    // this.ordersService.newOrder(this.restaurantId, table.tableId)
    // .subscribe(x => console.log('New order created', x));
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

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.waiterCallSubscription?.unsubscribe();
    this.snoozeWaiterCallSubscription?.unsubscribe();
  }
}
