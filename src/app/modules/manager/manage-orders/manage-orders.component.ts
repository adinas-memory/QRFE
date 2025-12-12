import { ButtonsComponent } from './../../../views/buttons/buttons/buttons.component';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { IconDirective } from '@coreui/icons-angular';
import { BadgeComponent, CardBodyComponent, CardComponent, CardFooterComponent, CardGroupComponent, CardHeaderComponent, CardImgDirective, CardTextDirective, CardTitleDirective, ColComponent, ColDirective, DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective, RowComponent, Tabs2Module, TemplateIdDirective, WidgetStatAComponent, WidgetStatFComponent } from '@coreui/angular';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AuthService } from '../../../core/auth/auth.service';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { filter, Subject, take, takeUntil } from 'rxjs';
import { NgFor, NgIf, NgStyle, CurrencyPipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { cilBellExclamation } from '@coreui/icons';
import { UserContextModel } from '../../../core/models/userContextModel';
import { SnoozeWaiterCallEvent, WaiterCallEvent } from '../../../core/models/callWaiter/callWaiter';
import { MenuService } from '../../../core/services/menu-public/menu.service';


@Component({
  selector: 'app-manage-orders',
  imports:
    [RowComponent, Tabs2Module,
      ColComponent, NgFor, NgIf,
      CardBodyComponent, CurrencyPipe, JsonPipe,
      CardComponent, CardGroupComponent, CardHeaderComponent,
      CardFooterComponent, ButtonsComponent,
      CardImgDirective, BadgeComponent,
      CardTextDirective,
      CardTitleDirective,
      ColComponent,
      ColDirective,
      NgStyle,
      IconDirective, RouterLink,
    ],
  standalone: true,
  templateUrl: './manage-orders.component.html'
})

export class ManageOrdersComponent implements OnInit, OnDestroy {
  icons = { cilBellExclamation };
  private destroy$ = new Subject<void>();
  private restaurantId = '';
  private waiterCallSubscription: any;
  private snoozeWaiterCallSubscription: any;

  tables: TableDTO[] = [];
  openTables: TableDTO[] = [];
  closedTables: TableDTO[] = [];
  subTotal: number = 0;
  waiterCalls: Record<string, number> = {};
  waiterSnoozed: Record<string, boolean> = {};


  constructor(private tablesService: TablesService,
    private authService: AuthService, private menuService: MenuService
  ) { }

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
    this.menuService.callWaiter(this.restaurantId, tableId)
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
      });

    this.waiterCallSubscription = this.tablesService.listenForWaiterCall(this.restaurantId)
      .subscribe({
        next: (response: WaiterCallEvent) => {
          const tableId = response.Data.TableId;
          // dacă nu există, îl inițializăm la 0
          if (!this.waiterCalls[tableId]) {
            this.waiterCalls[tableId] = 0;
          }
          // incrementăm chemările reale
          this.waiterCalls[tableId]++;
          this.waiterSnoozed[tableId] = false;
        },
        error: (err: unknown) => console.error('SSE error:', err)
      });

    this.snoozeWaiterCallSubscription = this.tablesService.listenSnoozeWaiterCall(this.restaurantId)
      .subscribe({
        next: (response: SnoozeWaiterCallEvent) => {
          const tableId = response.Data.TableId;
          this.waiterSnoozed[tableId] = true;
        },
        error: (err: unknown) => console.error('SSE error:', err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.waiterCallSubscription?.unsubscribe();
    this.snoozeWaiterCallSubscription?.unsubscribe();
  }

}
