import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BadgeComponent,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormLabelDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { OrderDTO } from '../../../core/models/orderingModel';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { OrdersService } from '../../../core/services/order-service/orders.service';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';

export interface OrderHistoryRow {
  order: OrderDTO;
  tableId: string;
  tableName: string;
}

export interface OrderHistoryPeriodTotal {
  currency: string;
  orderCount: number;
  totalAmount: number;
}

@Component({
  selector: 'app-table-orders-by-date',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    FormLabelDirective,
    FormControlDirective,
    ButtonDirective,
    TableDirective,
    BadgeComponent,
    TranslocoPipe
  ],
  templateUrl: './table-orders-by-date.component.html',
  styleUrl: './table-orders-by-date.component.scss'
})
export class TableOrdersByDateComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  restaurantId = '';
  apiScope: 'staff' | 'admin' = 'staff';
  tables: TableDTO[] = [];
  startDate = '';
  endDate = '';
  loading = false;
  reportLoaded = false;
  orderRows: OrderHistoryRow[] = [];
  periodTotals: OrderHistoryPeriodTotal[] = [];
  expandedRowKey: string | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly ordersService: OrdersService,
    private readonly tablesService: TablesService,
    private readonly toast: AppToastService,
    private readonly misc: MiscellaneousService,
    private readonly transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUserSnapshot();
    this.restaurantId =
      user?.restaurantId == null || user.restaurantId === ''
        ? ''
        : String(Array.isArray(user.restaurantId) ? user.restaurantId[0] : user.restaurantId);
    this.apiScope = user?.role === 'manager' ? 'admin' : 'staff';

    const today = TableOrdersByDateComponent.formatLocalDateOnly(new Date());
    this.startDate = today;
    this.endDate = today;

    if (this.restaurantId) {
      this.loadReport();
    }
  }

  private static formatLocalDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  loadReport(): void {
    if (!this.restaurantId) {
      this.toast.error(this.transloco.translate('orderHistory.noRestaurant'), 'Error');
      return;
    }
    if (!this.startDate || !this.endDate) {
      return;
    }
    if (this.startDate > this.endDate) {
      this.toast.error(this.transloco.translate('orderHistory.invalidRange'), 'Error');
      return;
    }

    this.loading = true;
    this.expandedRowKey = null;

    const tables$ = this.tables.length
      ? of(this.tables)
      : this.tablesService.getAll(this.restaurantId).pipe(
          map(tables =>
            (tables ?? []).slice().sort((a, b) =>
              (a.tableName ?? '').localeCompare(b.tableName ?? '', undefined, { numeric: true })
            )
          )
        );

    tables$
      .pipe(
        switchMap(tables => {
          this.tables = tables;
          if (!tables.length) {
            return of([] as { table: TableDTO; orders: OrderDTO[] }[]);
          }
          return forkJoin(
            tables.map(table =>
              this.ordersService
                .listOrdersForTableByDate(
                  this.restaurantId,
                  table.tableId,
                  this.startDate,
                  this.endDate,
                  this.apiScope
                )
                .pipe(map(orders => ({ table, orders: orders ?? [] })))
            )
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: results => {
          this.orderRows = results
            .flatMap(({ table, orders }) =>
              orders.map(order => ({
                order,
                tableId: table.tableId,
                tableName: this.tableLabel(table)
              }))
            )
            .sort((a, b) => (b.order.createdOn ?? '').localeCompare(a.order.createdOn ?? ''));
          this.periodTotals = this.buildPeriodTotals(this.orderRows);
          this.reportLoaded = true;
          this.loading = false;
        },
        error: err => {
          this.loading = false;
          this.toast.error(
            this.misc.getFirstErrorMessage(err) ?? this.transloco.translate('orderHistory.error'),
            'Error'
          );
        }
      });
  }

  private buildPeriodTotals(rows: OrderHistoryRow[]): OrderHistoryPeriodTotal[] {
    const byCurrency = new Map<string, OrderHistoryPeriodTotal>();
    for (const row of rows) {
      const currency = this.orderCurrency(row.order);
      if (!currency) {
        continue;
      }
      const existing = byCurrency.get(currency) ?? { currency, orderCount: 0, totalAmount: 0 };
      existing.orderCount += 1;
      existing.totalAmount += this.orderTotal(row.order);
      byCurrency.set(currency, existing);
    }
    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }

  tableLabel(table: TableDTO): string {
    return table.tableName?.trim() || table.tableId;
  }

  rowKey(row: OrderHistoryRow): string {
    return `${row.tableId}:${row.order.orderId}`;
  }

  toggleOrderDetails(row: OrderHistoryRow): void {
    const key = this.rowKey(row);
    this.expandedRowKey = this.expandedRowKey === key ? null : key;
  }

  orderTotal(order: OrderDTO): number {
    return order.finalTotalPrice?.amount ?? order.subTotal?.amount ?? 0;
  }

  orderCurrency(order: OrderDTO): string {
    return (order.finalTotalPrice?.currency ?? order.subTotal?.currency ?? order.currency ?? '').toString();
  }

  itemCount(order: OrderDTO): number {
    return (order.orderItems ?? []).reduce((sum, item) => sum + (item?.quantity ?? 0), 0);
  }

  currencyLabel(code: string): string {
    return code ? code.toUpperCase() : '—';
  }
}
