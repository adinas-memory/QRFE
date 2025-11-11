import { CurrencyPipe, JsonPipe, NgFor } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, BadgeComponent, ButtonDirective, ModalBodyComponent, ModalComponent, TabDirective, TabPanelComponent, Tabs2Module, TabsListComponent, TemplateIdDirective } from '@coreui/angular';
import { Subject, takeUntil } from 'rxjs';
import { MenuItem, MenuResponse } from '../../../core/models/menu/menuItem';

import { MenuService } from '../../../core/services/menu-public/menu.service';

@Component({
  selector: 'app-menu',
  imports: [TabsListComponent,
    TabPanelComponent, ModalComponent, ModalBodyComponent,
    TabDirective, AccordionComponent, TemplateIdDirective,
    CurrencyPipe, Tabs2Module, AccordionComponent, JsonPipe,
    AccordionItemComponent, AccordionButtonDirective, NgFor, TabPanelComponent,
    TabsListComponent,
    AccordionButtonDirective,
    AccordionItemComponent,],
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],

})
export class MenuComponent implements OnInit {
  menuItems: MenuItem[] = [];
  categories: string[] = [];
  forceRefreshAfterUpdate = Date.now();
  private destroy$ = new Subject<void>();
  private restaurantId = '';
  private tableId = '';
  imageModalVisible = false;
  selectedImageUrl = '';
  selectedImageName = '';


  constructor(private menuItemService: MenuService,
    private route: ActivatedRoute) { }


  get groupedMenuItems(): { [category: string]: MenuItem[] } {
    return this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  openImageModal(item: MenuItem): void {
    this.selectedImageUrl = item.menuItemIconUrl + '?v=' + this.forceRefreshAfterUpdate;
    this.selectedImageName = item.menuItemName;
    this.imageModalVisible = true;
  }

  get nonEmptyCategories(): string[] {
    return this.categories.filter(cat => this.groupedMenuItems[cat]?.length);
  }


  loadMenuItems(): void {
    this.menuItemService.getAll(this.restaurantId, this.tableId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.menuItems = response.menu?.menuItems ?? [];
          this.categories = response.categories ?? [];
        },
        error: err => console.error('[MenuComponent] Error loading menu items', err)
      });
  }

  ngOnInit(): void {
    const response = this.route.snapshot.data['menuData'] as MenuResponse;
    this.menuItems = response.menu?.menuItems ?? [];
    this.categories = response.categories ?? [];
    console.log('MenuComponent items:', this.menuItems);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
