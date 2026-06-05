import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
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
    TranslocoPipe
  ],
  templateUrl: './gadmin-dashboard.component.html',
  styleUrl: './gadmin-dashboard.component.scss'
})
export class GadminDashboardComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  loading = true;
  totalCount = 0;
  totalTables = 0;
  totalBars = 0;
  typeBreakdown: Record<string, number> = {};
  restaurants: RestaurantStatisticDTO[] = [];

  constructor(private globalAdmin: GlobalAdminService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.globalAdmin.listRestaurants(1, 1)
      .pipe(
        switchMap(first => {
          const count = first.totalCount;
          const pageSize = Math.max(count, 1);
          const capped = Math.min(pageSize, 100);
          return this.globalAdmin.listRestaurants(1, capped);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: res => {
          const list = res.result ?? [];
          this.totalCount = res.totalCount;
          this.restaurants = list;
          this.totalTables = list.reduce((sum, r) => sum + (r.numberOfTables ?? 0), 0);
          this.totalBars = list.reduce((sum, r) => sum + (r.numberOfBars ?? 0), 0);
          this.typeBreakdown = list.reduce<Record<string, number>>((acc, r) => {
            const key = (r.restaurantType ?? 'unknown').toLowerCase();
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  typeKeys(): string[] {
    return Object.keys(this.typeBreakdown).sort();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
