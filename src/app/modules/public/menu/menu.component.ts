import { CurrencyPipe, NgFor } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  AccordionButtonDirective, AccordionComponent, AccordionItemComponent,
  ModalBodyComponent, ModalComponent, Tabs2Module, TemplateIdDirective,
} from '@coreui/angular';
import { Subject } from 'rxjs';
import { MenuItem, MenuResponse } from '../../../core/models/menu/menuItem';

@Component({
  selector: 'app-menu',
  imports: [
    ModalComponent, ModalBodyComponent,
    AccordionComponent, AccordionItemComponent, AccordionButtonDirective,
    TemplateIdDirective, CurrencyPipe, Tabs2Module, NgFor,
  ],
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent implements OnInit, OnDestroy {
  menuItems: MenuItem[] = [];
  categories: string[] = [];
  menuName = '';
  forceRefreshAfterUpdate = Date.now();
  private destroy$ = new Subject<void>();
  imageModalVisible = false;
  selectedImageUrl = '';
  selectedImageName = '';

  constructor(private route: ActivatedRoute) {}

  get groupedMenuItems(): { [category: string]: MenuItem[] } {
    return this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  get nonEmptyCategories(): string[] {
    return this.categories.filter(cat => this.groupedMenuItems[cat]?.length);
  }

  openImageModal(item: MenuItem): void {
    this.selectedImageUrl = item.menuItemIconUrl + '?v=' + this.forceRefreshAfterUpdate;
    this.selectedImageName = item.menuItemName;
    this.imageModalVisible = true;
  }

  ngOnInit(): void {
    const response = this.route.snapshot.data['menuData'] as MenuResponse;
    this.menuItems = response.menu?.menuItems ?? [];
    this.categories = response.categories ?? [];
    this.menuName = response.restaurantName ?? '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
