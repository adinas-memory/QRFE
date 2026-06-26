import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  BadgeComponent, ButtonDirective, ContainerComponent, FooterComponent,
  NavbarBrandDirective, NavbarComponent,
  DropdownComponent, DropdownDividerDirective, DropdownHeaderDirective,
  DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { MenuService, PublicRestaurantSseEvent } from '../../../core/services/menu-public/menu.service';
import { GuestMenuViewService } from '../../../core/services/menu-public/guest-menu-view.service';
import { MenuResponse, WaiterCallResponse } from '../../../core/models/menu/menuItem';
import { OrderDTO } from '../../../core/models/orderingModel';
import { NgClass } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppFooterContentComponent } from '@app/shared/components/layout/app-footer-content.component';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { HttpErrorResponse } from '@angular/common/http';
import { LANG_STORAGE_KEY, type AppLang } from '../../../core/i18n/transloco.config';
import {
  BehaviorSubject,
  Subject,
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  fromEvent,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

@Component({
  selector: 'app-public-layout',
  imports: [
    RouterOutlet,
    BadgeComponent, FooterComponent, ButtonDirective, ContainerComponent,
    NavbarBrandDirective, NavbarComponent, IconDirective, NgClass,
    DropdownComponent, DropdownDividerDirective, DropdownHeaderDirective,
    DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
    TranslocoPipe,
    AppFooterContentComponent,
  ],
  standalone: true,
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent implements OnInit, OnDestroy {
  restaurantName = 'Restaurant';
  menuResponse!: MenuResponse;
  restaurantId = '';
  tableId = '';
  waiterCounterCall = 3;
  waiterCalled = false;
  /** Total ordered quantity for this table; drives the “My order” badge. */
  orderLineQuantityTotal = 0;
  ecoBonBusy = false;
  year = new Date().getFullYear();
  poweredBy = environment.poweredBy;
  frontendPubicUrl = environment.apiUrl;
  theme: 'dark' | 'light' = 'dark';
  /** True on `/public/menu/.../order` — hide set-menu header controls there. */
  isOnOrderPage = false;

  private destroy$ = new Subject<void>();
  private readonly tabVisible$ = new BehaviorSubject(document.visibilityState === 'visible');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private transloco: TranslocoService,
    private toast: AppToastService,
    readonly guestMenuView: GuestMenuViewService,
    private cdr: ChangeDetectorRef,
  ) {}

  get showSetMenuButton(): boolean {
    return !this.isOnOrderPage
      && !this.guestMenuView.showingSetMenuView
      && !!this.guestMenuView.todaySetMenu;
  }

  get showBackToMainMenu(): boolean {
    return !this.isOnOrderPage && this.guestMenuView.showingSetMenuView;
  }

  get showSetMenuTopbar(): boolean {
    return !this.isOnOrderPage && (this.showBackToMainMenu || this.showSetMenuButton);
  }

  openSetMenuView(): void {
    this.guestMenuView.showSetMenuView();
    this.cdr.detectChanges();
  }

  backToMainMenu(): void {
    this.guestMenuView.hideSetMenuView();
    this.cdr.detectChanges();
  }

  viewOrder(): void {
    const rid = this.restaurantId || this.route.snapshot.paramMap.get('restaurantId');
    const tid = this.tableId || this.route.snapshot.paramMap.get('tableId');
    this.router.navigateByUrl(`/public/menu/${rid}/tables/${tid}/order`);
  }

  get ecoBonUrl(): string {
    return this.menuService.getEcoBonUrl(this.restaurantId, this.tableId);
  }

  downloadEcoBon(): void {
    if (!this.restaurantId || !this.tableId || this.ecoBonBusy) return;
    this.ecoBonBusy = true;
    this.menuService.downloadEcoBon(this.restaurantId, this.tableId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'ECO-BON.pdf';
          anchor.click();
          URL.revokeObjectURL(url);
          this.ecoBonBusy = false;
        },
        error: err => this.handleEcoBonError(err),
      });
  }

  async shareEcoBon(): Promise<void> {
    if (!this.restaurantId || !this.tableId) return;
    const url = this.ecoBonUrl;
    const title = this.transloco.translate('client.ecoBon');
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await this.copyEcoBonLink();
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') {
        console.warn('[PublicLayout] share ECO BON failed', err);
      }
    }
  }

  async copyEcoBonLink(): Promise<void> {
    if (!this.restaurantId || !this.tableId) return;
    try {
      await navigator.clipboard.writeText(this.ecoBonUrl);
      this.toast.success(this.transloco.translate('client.ecoBonShareCopied'));
    } catch {
      this.toast.error(this.transloco.translate('client.ecoBonError'));
    }
  }

  private handleEcoBonError(err: unknown): void {
    this.ecoBonBusy = false;
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const msg = status === 429
      ? this.transloco.translate('client.ecoBonRateLimited')
      : this.transloco.translate('client.ecoBonError');
    this.toast.error(msg);
  }

  ngOnInit(): void {
    this.syncOrderPageFlag();
    this.theme = (localStorage.getItem('publicTheme') as 'dark' | 'light') || 'dark';

    this.guestMenuView.menuState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.detectChanges();
      });

    fromEvent(document, 'visibilitychange')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.tabVisible$.next(document.visibilityState === 'visible'));

    this.route.firstChild?.data.subscribe(data => {
      const response = data['menuData'] as MenuResponse;
      if (response) {
        this.restaurantName = response.restaurantName ?? this.restaurantName;
        this.menuResponse = response;
        this.waiterCounterCall = response.waiterCallCount ?? this.waiterCounterCall;
      }
    });

    const params$ = this.route.paramMap.pipe(
      map(pm => ({
        rid: pm.get('restaurantId') ?? '',
        tid: pm.get('tableId') ?? '',
      })),
      distinctUntilChanged((a, b) => a.rid === b.rid && a.tid === b.tid),
    );

    combineLatest([params$, this.tabVisible$])
      .pipe(
        switchMap(([{ rid, tid }, visible]) => {
          this.restaurantId = rid;
          this.tableId = tid;
          if (!rid || !tid) {
            this.orderLineQuantityTotal = 0;
            return EMPTY;
          }
          if (visible) {
            this.refreshOrderBadge();
          }
          if (!visible) {
            return EMPTY;
          }
          return this.menuService.listenPublicRestaurantSse(rid).pipe(
            tap(ev => this.handlePublicSse(ev, tid)),
            catchError(err => {
              console.warn('[PublicLayout] public SSE error', err);
              return EMPTY;
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.syncOrderPageFlag();
        if (this.restaurantId && this.tableId) {
          this.refreshOrderBadge();
        }
        this.cdr.markForCheck();
      });

    // Staff add/remove lines use internal-only SSE; poll lightly while the tab is visible.
    timer(35_000, 50_000)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => document.visibilityState === 'visible'),
        filter(() => !!this.restaurantId && !!this.tableId),
        switchMap(() =>
          this.menuService.getTableOrder(this.restaurantId, this.tableId).pipe(catchError(() => of(null))),
        ),
      )
      .subscribe(order => this.applyOrderBadgeCount(order));
  }

  private refreshOrderBadge(): void {
    if (!this.restaurantId || !this.tableId) {
      this.orderLineQuantityTotal = 0;
      return;
    }
    this.menuService
      .getTableOrder(this.restaurantId, this.tableId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null)),
      )
      .subscribe(order => this.applyOrderBadgeCount(order));
  }

  private applyOrderBadgeCount(order: OrderDTO | null): void {
    this.orderLineQuantityTotal = PublicLayoutComponent.countOrderLineQuantity(order);
  }

  private static countOrderLineQuantity(order: OrderDTO | null): number {
    const items = order?.orderItems?.filter((i): i is NonNullable<typeof i> => !!i) ?? [];
    return items.reduce((sum, i) => sum + (i.quantity ?? 0), 0);
  }

  /**
   * Backend sends `data: JsonSerializer.Serialize(SseEvent<T>)` — table id is on the inner `data` object.
   */
  private tableIdFromSseMessage(raw: unknown): string {
    const o = raw as Record<string, unknown> | null;
    if (!o) return '';
    const inner = o['data'] as Record<string, unknown> | undefined;
    const tid = inner?.['tableId'] ?? o['tableId'];
    return tid != null ? String(tid).toLowerCase() : '';
  }

  private handlePublicSse(ev: PublicRestaurantSseEvent, currentTableId: string): void {
    const cur = String(currentTableId).toLowerCase();
    const tableId = this.tableIdFromSseMessage(ev.data);

    if (ev.type === 'WaiterCall' || ev.type === 'WaiterCallSnoozed') {
      if (tableId && cur && tableId === cur) {
        this.waiterCalled = true;
        setTimeout(() => (this.waiterCalled = false), 4000);
      }
      return;
    }

    if (ev.type === 'NewOrderPublic') {
      if (tableId && cur && tableId === cur) {
        this.refreshOrderBadge();
      }
    }
  }

  callWaiter(): void {
    if (!this.restaurantId || !this.tableId) {
      console.warn('[PublicLayout] callWaiter ABORTED — missing restaurantId or tableId');
      return;
    }
    this.menuService.callWaiter(this.restaurantId, this.tableId).subscribe({
      next: (response: WaiterCallResponse) => {
        if (response.message?.trim()) {
          console.warn('[PublicLayout] callWaiter rejected:', response.message);
          return;
        }
        this.waiterCounterCall = response.counterCalls;
        this.waiterCalled = true;
        setTimeout(() => this.waiterCalled = false, 4000);
      },
      error: (err) => console.error('[PublicLayout] callWaiter HTTP error', err)
    });
  }

  setTheme(t: 'dark' | 'light') {
    this.theme = t;
    localStorage.setItem('publicTheme', t);
  }

  setLanguage(l: AppLang) {
    this.transloco.setActiveLang(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* ignore */ }
  }

  private syncOrderPageFlag(): void {
    this.isOnOrderPage = this.router.url.includes('/order');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
