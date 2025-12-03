import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { BadgeComponent, ButtonDirective, ContainerComponent, FooterComponent, NavbarBrandDirective, NavbarComponent } from '@coreui/angular';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { MenuResponse, WaiterCallResponse } from '../../../core/models/menu/menuItem';
import { NgIf } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, NgIf, BadgeComponent, FooterComponent,
     ButtonDirective, ContainerComponent, NavbarBrandDirective, NavbarComponent],
  standalone: true,
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent implements OnInit {
  restaurantName = 'Restaurant';
  menuResponse!: MenuResponse;
  restaurantId = '';
  tableId = '';
  waiterCounterCall = 3;
  year = new Date().getFullYear();
  poweredBy = environment.poweredBy;
  frontendPubicUrl = environment.apiUrl;

  constructor(private route: ActivatedRoute, private menuService: MenuService) { }

  ngOnInit(): void {
    this.route.firstChild?.data.subscribe(data => {
      const response = data['menuData'] as MenuResponse;
      this.restaurantName = response?.restaurantName ?? 'Restaurant';
      this.restaurantId = this.route.snapshot.paramMap.get('restaurantId') ?? '';
      this.tableId = this.route.snapshot.paramMap.get('tableId') ?? '';
      this.menuResponse = response;
      this.waiterCounterCall = response.waiterCallCount ?? 3;
    });
  }

  callWaiter(): void {
    this.menuService.callWaiter(this.restaurantId, this.tableId).subscribe((response: WaiterCallResponse) => {
      this.waiterCounterCall = response.counterCalls;
    })
  }
}
