import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import {
  AccordionButtonDirective, AccordionComponent, AccordionItemComponent,
  ModalBodyComponent, ModalComponent, Tabs2Module, TemplateIdDirective,
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { SetMenuDTO, setMenuLineTexts } from '../../../core/models/menu/setMenu';
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
  emptyReason: string | null | undefined;
  todaySetMenu: SetMenuDTO | null = null;
  forceRefreshAfterUpdate = Date.now();
  private destroy$ = new Subject<void>();
  imageModalVisible = false;
  selectedImageUrl = '';
  selectedImageName = '';

  constructor(
    private guestMenuView: GuestMenuViewService,
    private transloco: TranslocoService,
    private cdr: ChangeDetectorRef,
  ) {}

  get showingSetMenuView(): boolean {
    return this.guestMenuView.showingSetMenuView;
  }

  get setMenuDisplayLines(): string[] {
    if (!this.todaySetMenu) return [];
    return setMenuLineTexts(this.todaySetMenu, this.transloco.getActiveLang());
  }

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
        this.emptyReason = response.emptyReason;
        this.todaySetMenu = response.todaySetMenu ?? null;
      });

    this.guestMenuView.viewState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
