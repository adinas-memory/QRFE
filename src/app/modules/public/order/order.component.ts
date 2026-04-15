import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ButtonDirective, SpinnerComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { OrderDTO, OrderItemDTO } from '../../../core/models/orderingModel';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [
    CurrencyPipe,
    ButtonDirective, SpinnerComponent, IconDirective,
    TranslocoPipe,
  ],
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.scss'],
})
export class OrderComponent implements OnInit, OnDestroy {
  order: OrderDTO | null = null;
  loading = true;
  error = false;

  private restaurantId = '';
  private tableId = '';
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
  ) {}

  get validItems(): OrderItemDTO[] {
    return (this.order?.orderItems?.filter((i): i is OrderItemDTO => !!i) ?? []);
  }

  get itemCount(): number {
    return this.validItems.reduce((sum, i) => sum + i.quantity, 0);
  }

  ngOnInit(): void {
    this.restaurantId = this.route.parent?.snapshot.paramMap.get('restaurantId') ?? '';
    this.tableId = this.route.parent?.snapshot.paramMap.get('tableId') ?? '';
    this.loadOrder();
  }

  loadOrder(): void {
    if (!this.restaurantId || !this.tableId) return;
    this.loading = true;
    this.error = false;

    this.menuService.getTableOrder(this.restaurantId, this.tableId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          this.order = order;
          this.loading = false;
        },
        error: () => {
          this.error = true;
          this.loading = false;
        },
      });
  }

  goBackToMenu(): void {
    this.router.navigateByUrl(
      `/public/menu/${this.restaurantId}/tables/${this.tableId}`
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
