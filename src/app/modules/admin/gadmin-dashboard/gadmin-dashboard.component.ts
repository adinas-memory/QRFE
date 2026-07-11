import { DecimalPipe, NgFor } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormSelectDirective,
  RowComponent,
  TableDirective,
  TemplateIdDirective,
  WidgetStatAComponent
} from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { RestaurantStatisticDTO } from '../../../core/models/global-admin-restaurant.model';

@Component({
  selector: 'app-gadmin-dashboard',
  standalone: true,
  imports: [
    NgFor,
    DecimalPipe,
    RouterLink,
    RowComponent,
    ColComponent,
    WidgetStatAComponent,
    TemplateIdDirective,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    TableDirective,
    ButtonDirective,
    FormSelectDirective,
    TranslocoPipe
  ],
  templateUrl: './gadmin-dashboard.component.html',
  styleUrl: './gadmin-dashboard.component.scss'
})
export class GadminDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly pageSizeOptions = [10, 25, 50];

  statsLoading = true;
  tableLoading = true;
  totalCount = 0;
  totalTables = 0;
  totalBars = 0;
  typeBreakdown: Record<string, number> = {};
  restaurants: RestaurantStatisticDTO[] = [];

  pageNumber = 1;
  pageSize = 10;

  constructor(private globalAdmin: GlobalAdminService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadPage();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.pageNumber;
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, current - half);
    const end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  get showPagination(): boolean {
    return this.totalPages > 1;
  }

  loadStats(): void {
    this.statsLoading = true;
    this.globalAdmin.listRestaurants(1, 1)
      .pipe(
        switchMap(first => {
          const count = first.totalCount;
          this.totalCount = count;
          if (count <= 0) {
            return [{ result: [], totalCount: 0 }];
          }
          const capped = Math.min(Math.max(count, 1), 100);
          return this.globalAdmin.listRestaurants(1, capped);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: res => {
          const list = res.result ?? [];
          this.totalTables = list.reduce((sum, r) => sum + (r.numberOfTables ?? 0), 0);
          this.totalBars = list.reduce((sum, r) => sum + (r.numberOfBars ?? 0), 0);
          this.typeBreakdown = list.reduce<Record<string, number>>((acc, r) => {
            const key = (r.restaurantType ?? 'unknown').toLowerCase();
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          this.statsLoading = false;
        },
        error: () => {
          this.statsLoading = false;
        }
      });
  }

  loadPage(): void {
    this.tableLoading = true;
    this.globalAdmin.listRestaurants(this.pageNumber, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.restaurants = res.result ?? [];
          this.totalCount = res.totalCount;
          this.tableLoading = false;
        },
        error: () => {
          this.tableLoading = false;
        }
      });
  }

  onPageSizeChange(raw: string): void {
    const next = Number(raw);
    if (!Number.isFinite(next) || next <= 0) return;
    this.pageSize = next;
    this.pageNumber = 1;
    this.loadPage();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.pageNumber || this.tableLoading) return;
    this.pageNumber = page;
    this.loadPage();
  }

  onPrevPage(): void {
    this.goToPage(this.pageNumber - 1);
  }

  onNextPage(): void {
    this.goToPage(this.pageNumber + 1);
  }

  typeKeys(): string[] {
    return Object.keys(this.typeBreakdown).sort();
  }

  formatNextInvoice(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  }

  formatCreatedBy(r: RestaurantStatisticDTO): string {
    if (r.createdByLabel) return r.createdByLabel;
    if (r.createdByRole === 'self') return 'Stripe';
    return '—';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
