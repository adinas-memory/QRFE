import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ButtonDirective, SpinnerComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { OrderDTO, OrderItemDTO } from '../../../core/models/orderingModel';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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
  paying = false;

  private restaurantId = '';
  private tableId = '';
  private readonly apiUrl = environment.apiUrl;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private http: HttpClient,
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

  payByCard(): void {
    if (!this.order?.orderId || !this.restaurantId) return;

    this.paying = true;
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H_checkout',location:'order.component.ts:payByCard',message:'starting diner checkout session',data:{restaurantId:this.restaurantId,tableId:this.tableId,orderId:this.order.orderId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    this.http
      .post<{ checkoutUrl: string }>(
        `${this.apiUrl}/api/payments/checkout-session`,
        { restaurantId: this.restaurantId, orderId: this.order.orderId },
        { withCredentials: true }
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.paying = false;
          if (res?.checkoutUrl) {
            // #region agent log
            fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909afb'},body:JSON.stringify({sessionId:'909afb',runId:'pre-fix',hypothesisId:'H_checkout',location:'order.component.ts:payByCard:redirect',message:'redirecting browser to Stripe checkoutUrl',data:{hasCheckoutUrl:true},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            window.location.href = res.checkoutUrl;
          }
        },
        error: err => {
          console.error('Failed to start card payment', err);
          this.paying = false;
        }
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
