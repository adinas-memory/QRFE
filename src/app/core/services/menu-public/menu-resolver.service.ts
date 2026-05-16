import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { MenuResponse } from '../../models/menu/menuItem';
import { MenuService } from './menu.service';
import { GuestMenuViewService } from './guest-menu-view.service';

@Injectable({ providedIn: 'root' })
export class MenuResolver implements Resolve<MenuResponse> {
  constructor(
    private menuService: MenuService,
    private guestMenuView: GuestMenuViewService,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<MenuResponse> {
    const restaurantId = route.paramMap.get('restaurantId')!;
    const tableId = route.paramMap.get('tableId')!;
    return this.menuService.getAll(restaurantId, tableId).pipe(
      tap(response => this.guestMenuView.initFromResponse(response, restaurantId, tableId)),
    );
  }
}
