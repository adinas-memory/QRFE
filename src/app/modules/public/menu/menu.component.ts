import { CurrencyPipe, JsonPipe, NgFor } from '@angular/common';
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, ButtonDirective, ModalBodyComponent, ModalComponent, TabDirective, TabPanelComponent, Tabs2Module, TabsListComponent, TemplateIdDirective } from '@coreui/angular';
import { Subject, takeUntil } from 'rxjs';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
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
          // log the raw response from backend
          console.log('[MenuComponent] Raw response from backend:', response);

          this.menuItems = (response.menu?.menuItems ?? []).map(item => ({
            ...item,
            category: item.category
          }));

          // log the mapped menuItems array
          console.log('[MenuComponent] Mapped menuItems:', this.menuItems);
        },
        error: err => console.error('[MenuComponent] Error loading menu items', err)
      });
  }


  loadCategories(): void {
    this.menuItemService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe(cats => {
        this.categories = cats ?? [];
        console.log('[MenuComponent] Categories:', this.categories);
      });
  }


  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.restaurantId = params.get('restaurantId') ?? '';
        this.tableId = params.get('tableId') ?? '';

        this.loadCategories();
        this.loadMenuItems();

      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
