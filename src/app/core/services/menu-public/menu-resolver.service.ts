import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { MenuResponse } from '../../models/menu/menuItem';
import { MenuService } from './menu.service';
import { GuestMenuViewService } from './guest-menu-view.service';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class MenuResolver implements Resolve<MenuResponse> {
  constructor(
    private menuService: MenuService,
    private guestMenuView: GuestMenuViewService,
    private transloco: TranslocoService,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<MenuResponse> {
    const restaurantId = route.paramMap.get('restaurantId')!;
    const tableId = route.paramMap.get('tableId')!;
    const locale = this.transloco.getActiveLang();
    return this.menuService.getAll(restaurantId, tableId, locale).pipe(
      tap(response => this.guestMenuView.initFromResponse(response, restaurantId, tableId)),
    );
  }
}
