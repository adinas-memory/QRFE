import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { MenuService } from './menu.service';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class GuestMenuViewService {
  private readonly response$ = new BehaviorSubject<MenuResponse | null>(null);
  private readonly viewTick$ = new BehaviorSubject(0);

  restaurantId = '';
  tableId = '';
  showingSetMenuView = false;

  readonly menuState$ = this.response$.asObservable();
  readonly viewState$ = this.viewTick$.asObservable();

  constructor(
    private menuService: MenuService,
    private transloco: TranslocoService,
  ) {}

  get snapshot(): MenuResponse | null {
    return this.response$.value;
  }

  get menuItems(): MenuItem[] {
    return this.response$.value?.menu?.menuItems ?? [];
  }

  get categories(): string[] {
    return this.response$.value?.categories ?? [];
  }

  get emptyReason(): string | null | undefined {
    return this.response$.value?.emptyReason;
  }

  get todaySetMenu() {
    return this.response$.value?.todaySetMenu ?? null;
  }

  showSetMenuView(): void {
    this.showingSetMenuView = true;
    this.viewTick$.next(this.viewTick$.value + 1);
  }

  hideSetMenuView(): void {
    this.showingSetMenuView = false;
    this.viewTick$.next(this.viewTick$.value + 1);
  }

  initFromResponse(response: MenuResponse, restaurantId: string, tableId: string): void {
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.applyResponse(response);
  }

  showDefault(): Observable<MenuResponse> {
    this.showingSetMenuView = false;
    return this.reloadMenu();
  }

  reloadMenu(locale?: string): Observable<MenuResponse> {
    const activeLocale = locale ?? this.transloco.getActiveLang();
    return this.menuService
      .getAll(this.restaurantId, this.tableId, activeLocale)
      .pipe(tap(response => this.applyResponse(response)));
  }

  private applyResponse(response: MenuResponse): void {
    this.response$.next(response);
  }
}
