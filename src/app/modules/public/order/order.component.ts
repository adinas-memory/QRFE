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
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, filter, fromEvent, of, switchMap, timer } from 'rxjs';

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
  cardPaymentsAvailable: boolean | null = null;
  private readonly tabVisible$ = fromEvent(document, 'visibilitychange').pipe(
    // document.visibilityState is 'visible' | 'hidden'
    switchMap(() => of(document.visibilityState === 'visible')),
  );

  private restaurantId = '';
  private tableId = '';
  private readonly apiUrl = environment.apiUrl;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private http: HttpClient,
    private toast: AppToastService,
    private misc: MiscellaneousService,
    private transloco: TranslocoService,
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
    this.loadCardPaymentsStatus();

    // Keep the order view in sync if quantities are changed elsewhere.
    // Public SSE only broadcasts new empty orders; quantity changes need polling.
    timer(12_000, 12_000)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => document.visibilityState === 'visible'),
      )
      .subscribe(() => this.loadOrder());
  }

  loadCardPaymentsStatus(): void {
    if (!this.restaurantId) return;
    this.http.get<{
      available: boolean;
      stripeChargesEnabled: boolean;
      stripePayoutsEnabled: boolean;
      stripeDetailsSubmitted: boolean;
    }>(`${this.apiUrl}/api/public/${this.restaurantId}/payments/status`, { withCredentials: true })
      .pipe(
        catchError(() => of(null))
      )
      .subscribe(res => {
        this.cardPaymentsAvailable = res?.available ?? null;
      });
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
            window.location.href = res.checkoutUrl;
          }
        },
        error: err => {
          console.error('Failed to start card payment', err);
          const raw = this.misc.getFirstErrorMessage(err);
          const msg = /onboarding pending/i.test(raw)
            ? this.transloco.translate('client.cardPaymentsPendingBody')
            : raw;
          const title = /onboarding pending/i.test(raw)
            ? this.transloco.translate('client.cardPaymentsPendingTitle')
            : this.transloco.translate('payment.failure.title');
          this.toast.error(msg, title);
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
