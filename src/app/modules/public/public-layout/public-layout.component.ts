import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import {
  BadgeComponent, ButtonDirective, ContainerComponent, FooterComponent,
  NavbarBrandDirective, NavbarComponent,
  DropdownComponent, DropdownDividerDirective, DropdownHeaderDirective,
  DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { MenuResponse, WaiterCallResponse } from '../../../core/models/menu/menuItem';
import { NgClass } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LANG_STORAGE_KEY, type AppLang } from '../../../core/i18n/transloco.config';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-public-layout',
  imports: [
    RouterOutlet,
    BadgeComponent, FooterComponent, ButtonDirective, ContainerComponent,
    NavbarBrandDirective, NavbarComponent, IconDirective, NgClass,
    DropdownComponent, DropdownDividerDirective, DropdownHeaderDirective,
    DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
    TranslocoPipe,
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
  year = new Date().getFullYear();
  poweredBy = environment.poweredBy;
  frontendPubicUrl = environment.apiUrl;
  theme: 'dark' | 'light' = 'dark';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private menuService: MenuService,
    private transloco: TranslocoService,
  ) {}

  viewOrder(): void {
    const rid = this.restaurantId || this.route.snapshot.paramMap.get('restaurantId');
    const tid = this.tableId || this.route.snapshot.paramMap.get('tableId');
    this.router.navigateByUrl(`/public/menu/${rid}/tables/${tid}/order`);
  }

  ngOnInit(): void {
    this.theme = (localStorage.getItem('publicTheme') as 'dark' | 'light') || 'dark';

    this.route.firstChild?.data.subscribe(data => {
      const response = data['menuData'] as MenuResponse;
      this.restaurantName = response?.restaurantName ?? 'Restaurant';
      this.restaurantId = this.route.snapshot.paramMap.get('restaurantId') ?? '';
      this.tableId = this.route.snapshot.paramMap.get('tableId') ?? '';
      this.menuResponse = response;
      this.waiterCounterCall = response.waiterCallCount ?? 3;
    });

    if (this.restaurantId || this.route.snapshot.paramMap.get('restaurantId')) {
      const rid = this.restaurantId || this.route.snapshot.paramMap.get('restaurantId')!;
      this.menuService.listenWaiterEvents(rid)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (ev) => {
            if (ev.type === 'WaiterCall') {
              this.waiterCalled = true;
              setTimeout(() => this.waiterCalled = false, 4000);
            }
          },
          error: (err) => console.warn('[PublicLayout] public SSE error', err)
        });
    } else {
      console.warn('[PublicLayout] SSE NOT opened — restaurantId is empty at this point');
    }
  }

  callWaiter(): void {
    if (!this.restaurantId || !this.tableId) {
      console.warn('[PublicLayout] callWaiter ABORTED — missing restaurantId or tableId');
      return;
    }
    this.menuService.callWaiter(this.restaurantId, this.tableId).subscribe({
      next: (response: WaiterCallResponse) => {
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
