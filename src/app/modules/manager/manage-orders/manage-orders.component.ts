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
import { mockTables } from '../manage-orders/mock.tables';
import { cilBellExclamation } from '@coreui/icons';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { WaiterCallEvent } from '../../../core/models/callWaiter/callWaiter';


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
  private waiterSubscription: any;

  tables: TableDTO[] = [];
  openTables: TableDTO[] = [];
  closedTables: TableDTO[] = [];
  subTotal: number = 0;
  waiterCalls: Record<string, number> = {};


  constructor(private tablesService: TablesService,
    private authService: AuthService, private menuService: MenuService
  ) { }

  snoozeWaiterCall(tableId: string): void {
    this.tablesService.snoozeWaiterCall(this.restaurantId, tableId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Reset the waiter call count for the table
        },
        error: err => console.error('[ManageTablesComponent] Error snoozing waiter call', err)
      });
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

    this.waiterSubscription = this.menuService.listenForWaiterCall(this.restaurantId)
      .subscribe({
        next: (response: WaiterCallEvent) => {
          const tableId = response.Data.TableId;

          // dacă nu există, îl inițializăm la 0
          if (!this.waiterCalls[tableId]) {
            this.waiterCalls[tableId] = 0;
          }

          // incrementăm chemările reale
          this.waiterCalls[tableId]++;

          console.log("Waiter calls for table:", tableId, this.waiterCalls[tableId]);
        },
        error: (err: unknown) => console.error('SSE error:', err)
      });
  }

  ngOnDestroy(): void {
    this.waiterSubscription.unsubscribe();
  }

}
