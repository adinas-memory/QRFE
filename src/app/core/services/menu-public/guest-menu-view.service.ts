import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { MenuItem, MenuResponse } from '../../models/menu/menuItem';
import { MenuService } from './menu.service';

@Injectable({ providedIn: 'root' })
export class GuestMenuViewService {
  private readonly response$ = new BehaviorSubject<MenuResponse | null>(null);

  restaurantId = '';
  tableId = '';
  defaultGuestView = 'fixed';
  currentView = 'fixed';
  alternateGuestViews: string[] = [];

  readonly menuState$ = this.response$.asObservable();

  constructor(private menuService: MenuService) {}

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

  get activeGuestView(): string {
    return this.response$.value?.activeGuestView
      ?? this.response$.value?.menuPresentationMode
      ?? 'fixed';
  }

  get isOnDefaultView(): boolean {
    return this.currentView === this.defaultGuestView;
  }

  initFromResponse(response: MenuResponse, restaurantId: string, tableId: string): void {
    this.restaurantId = restaurantId;
    this.tableId = tableId;
    this.applyResponse(response);
  }

  loadView(viewAs: string): Observable<MenuResponse> {
    return this.menuService
      .getAll(this.restaurantId, this.tableId, { viewAs })
      .pipe(tap(response => this.applyResponse(response)));
  }

  showDefault(): Observable<MenuResponse> {
    return this.menuService
      .getAll(this.restaurantId, this.tableId)
      .pipe(tap(response => this.applyResponse(response)));
  }

  private applyResponse(response: MenuResponse): void {
    this.defaultGuestView = (response.defaultGuestView ?? response.menuPresentationMode ?? 'fixed').toLowerCase();
    this.currentView = (response.activeGuestView ?? response.menuPresentationMode ?? this.defaultGuestView).toLowerCase();
    this.alternateGuestViews = (response.alternateGuestViews ?? []).map(v => v.toLowerCase());
    this.response$.next(response);
  }
}
