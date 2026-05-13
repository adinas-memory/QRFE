import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  AccordionButtonDirective, AccordionComponent, AccordionItemComponent,
  ModalBodyComponent, ModalComponent, Tabs2Module, TemplateIdDirective,
} from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { GuestMenuViewService } from '../../../core/services/menu-public/guest-menu-view.service';

@Component({
  selector: 'app-menu',
  imports: [
    ModalComponent, ModalBodyComponent,
    AccordionComponent, AccordionItemComponent, AccordionButtonDirective,
    TemplateIdDirective, CurrencyPipe, Tabs2Module, NgFor,
    NgIf,
    TranslocoPipe,
  ],
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
})
export class MenuComponent implements OnInit, OnDestroy {
  menuItems: MenuItem[] = [];
  categories: string[] = [];
  menuName = '';
  activeGuestView = '';
  emptyReason: string | null | undefined;
  forceRefreshAfterUpdate = Date.now();
  private destroy$ = new Subject<void>();
  imageModalVisible = false;
  selectedImageUrl = '';
  selectedImageName = '';

  constructor(private guestMenuView: GuestMenuViewService) {}

  get groupedMenuItems(): { [category: string]: MenuItem[] } {
    return this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }

  get emptyGuestMessageKey(): string | null {
    switch (this.emptyReason) {
      case 'no_items_for_today':
        return 'menu.guest.emptyNoItemsForToday';
      case 'no_items_for_weekday':
        return 'menu.guest.emptyNoItemsForWeekday';
      case 'no_menu_items':
        return 'menu.guest.emptyNoMenuItems';
      default:
        return null;
    }
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
    this.guestMenuView.menuState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(response => {
        if (!response) return;
        this.menuItems = response.menu?.menuItems ?? [];
        this.categories = response.categories ?? [];
        this.menuName = response.restaurantName ?? '';
        this.activeGuestView = this.guestMenuView.activeGuestView;
        this.emptyReason = response.emptyReason;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
