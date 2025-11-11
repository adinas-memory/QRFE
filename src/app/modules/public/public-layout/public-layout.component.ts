import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { ButtonDirective, ContainerComponent, NavbarBrandDirective, NavbarComponent } from '@coreui/angular';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { MenuResponse } from '../../../core/models/menu/menuItem';

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, ButtonDirective, ContainerComponent, NavbarBrandDirective, NavbarComponent],
  standalone: true,
  templateUrl: './public-layout.component.html',
  styleUrl: './public-layout.component.scss'
})
export class PublicLayoutComponent implements OnInit {
  restaurantName = 'Restaurant';
  menuResponse!: MenuResponse;

  constructor(private route: ActivatedRoute, private menuService: MenuService) { }

  ngOnInit(): void {
    this.route.firstChild?.data.subscribe(data => {
      const response = data['menuData'] as MenuResponse;
      this.restaurantName = response?.restaurantName ?? 'Restaurant';
      this.menuResponse = response;
    });
  }

  callWaiter(): void {

  }
}
