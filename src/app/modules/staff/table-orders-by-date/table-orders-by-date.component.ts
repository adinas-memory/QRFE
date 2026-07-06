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
  FormSelectDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth/auth.service';
import { OrderDTO } from '../../../core/models/orderingModel';
import { TableDTO } from '../../../core/models/restaurantTablesModel';
import { OrdersService } from '../../../core/services/order-service/orders.service';
import { TablesService } from '../../../core/services/tables-service/tables.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';

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
    FormSelectDirective,
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
  selectedTableId = '';
  startDate = '';
  endDate = '';
  loadingTables = false;
  loadingOrders = false;
  orders: OrderDTO[] = [];
  expandedOrderId: string | null = null;

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
      this.loadTables();
    }
  }

  private static formatLocalDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  loadTables(): void {
    if (!this.restaurantId) {
      return;
    }
    this.loadingTables = true;
    this.tablesService
      .getAll(this.restaurantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: tables => {
          this.tables = (tables ?? []).slice().sort((a, b) =>
            (a.tableName ?? '').localeCompare(b.tableName ?? '', undefined, { numeric: true })
          );
          if (!this.selectedTableId && this.tables.length) {
            this.selectedTableId = this.tables[0].tableId;
            this.loadOrders();
          }
          this.loadingTables = false;
        },
        error: err => {
          this.loadingTables = false;
          this.toast.error(
            this.misc.getFirstErrorMessage(err) ?? this.transloco.translate('tableOrdersByDate.error'),
            'Error'
          );
        }
      });
  }

  onTableChange(): void {
    this.expandedOrderId = null;
    this.loadOrders();
  }

  loadOrders(): void {
    if (!this.restaurantId) {
      this.toast.error(this.transloco.translate('tableOrdersByDate.noRestaurant'), 'Error');
      return;
    }
    if (!this.selectedTableId) {
      this.orders = [];
      return;
    }
    if (!this.startDate || !this.endDate) {
      return;
    }
    if (this.startDate > this.endDate) {
      this.toast.error(this.transloco.translate('tableOrdersByDate.invalidRange'), 'Error');
      return;
    }

    this.loadingOrders = true;
    this.ordersService
      .listOrdersForTableByDate(
        this.restaurantId,
        this.selectedTableId,
        this.startDate,
        this.endDate,
        this.apiScope
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: orders => {
          this.orders = (orders ?? []).slice().sort((a, b) =>
            (b.createdOn ?? '').localeCompare(a.createdOn ?? '')
          );
          this.loadingOrders = false;
        },
        error: err => {
          this.loadingOrders = false;
          this.toast.error(
            this.misc.getFirstErrorMessage(err) ?? this.transloco.translate('tableOrdersByDate.error'),
            'Error'
          );
        }
      });
  }

  tableLabel(table: TableDTO): string {
    return table.tableName?.trim() || table.tableId;
  }

  selectedTableLabel(): string {
    const table = this.tables.find(t => t.tableId === this.selectedTableId);
    return table ? this.tableLabel(table) : '—';
  }

  toggleOrderDetails(orderId: string): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
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
}
