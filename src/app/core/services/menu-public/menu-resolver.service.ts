import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { MenuResponse } from '../../models/menu/menuItem';
import { MenuService } from './menu.service';

@Injectable({ providedIn: 'root' })
export class MenuResolver implements Resolve<MenuResponse> {
  constructor(private menuService: MenuService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<MenuResponse> {
    const restaurantId = route.paramMap.get('restaurantId')!;
    const tableId = route.paramMap.get('tableId')!;
    return this.menuService.getAll(restaurantId, tableId);
  }
}
