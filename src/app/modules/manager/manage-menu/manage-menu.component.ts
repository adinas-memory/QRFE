import { MenuItemCategory } from './../../../core/models/menu/menuItem';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  Tabs2Module, TableDirective, FormControlDirective,
  FormLabelDirective, AccordionButtonDirective,
  AccordionComponent, AccordionItemComponent,
  TemplateIdDirective
} from '@coreui/angular';
import { } from '@coreui/angular';
import { MenuItemServiceService } from '../../../core/services/menu-item-service.service';
import { filter, Subject, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { AuthService } from '../../../core/auth/auth.service';
import { NgFor } from '@angular/common';
import { UserContextModel } from '../../../core/models/userContextModel';

@Component({
  selector: 'app-manage-menu',
  imports: [Tabs2Module, TableDirective, FormControlDirective,
    FormLabelDirective,
    NgFor, ReactiveFormsModule,
    AccordionButtonDirective,
    AccordionComponent, AccordionItemComponent,
    TemplateIdDirective
  ],
  standalone: true,
  templateUrl: './manage-menu.component.html'
})
export class ManageMenuComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private restaurantId = '';


  menuItems: MenuItem[] = [];
  categories: string[] = [];
  selectedItem: MenuItem | null = null;
  menuItemsForm: FormGroup;
  selectedFile: File | null = null;


  constructor(private menuItemService: MenuItemServiceService,
    private fb: FormBuilder, private authService: AuthService
  ) {
    this.menuItemsForm = this.fb.group({
      menuItemName: ['', Validators.required],
      menuItemDescription: ['', Validators.required],
      menuItemPriceAmount: [0, [Validators.required, Validators.min(0.01)]],
      menuItemCategory: ['', Validators.required],
      // isAvailable: [true],
      menuItemIcon: [null, Validators.required]
    });
  }

  get groupedMenuItems(): { [category: string]: MenuItem[] } {
    return this.menuItems.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(item);
      return acc;
    }, {} as { [category: string]: MenuItem[] });
  }


  loadMenuItems(): void {
    this.menuItemService.getAll(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.menuItems = (response.menu?.menuItems ?? []).map(item => ({
            ...item,
            category: item.category   // map backend field
          }));
        },
        error: err => console.error('[ManageMenuComponent] Error loading menu items', err)
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      // optional: preview
      const previewUrl = URL.createObjectURL(this.selectedFile);
      this.menuItemsForm.patchValue({ menuItemIcon: this.selectedFile });
    }
  }

  loadCategories(): void {
    this.menuItemService.getCategories(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(cats => { this.categories = cats ?? []; console.log('[ManageMenuComponent] categories response:', cats); });
  }

  onEdit(item: MenuItem): void {
    this.selectedItem = item;
    this.menuItemsForm.patchValue(item);
  }

  onDelete(item: MenuItem): void {
    if (confirm(`Delete "${item.menuItemName}"?`)) {
      this.menuItemService.delete(this.restaurantId, item.menuItemId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadMenuItems());
    }
  }

  onSubmit(): void {
    const formData = new FormData();
    // append all form fields
    formData.append('menuItemName', this.menuItemsForm.value.menuItemName);
    formData.append('menuItemDescription', this.menuItemsForm.value.menuItemDescription);
    formData.append('menuItemPriceAmount', this.menuItemsForm.value.menuItemPriceAmount);
    formData.append('menuItemCategory', this.menuItemsForm.value.menuItemCategory);
    // if a file was selected, append it
    if (this.selectedFile) {
      formData.append('menuItemIcon', this.selectedFile);
    }

    if (this.selectedItem) {
      console.log('Updating item:', this.selectedItem.menuItemId);
      // update existing item
      this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.resetForm();
          this.loadMenuItems();
        });
    } else {
      // create new item
      this.menuItemService.create(this.restaurantId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.resetForm();
          this.loadMenuItems();
        });
    }
  }

  ngOnInit(): void {
    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1)
      )
      .subscribe(user => {
        this.restaurantId = user?.restaurantId ?? '';
        this.loadMenuItems();
        this.loadCategories();
      });
  }

  resetForm(): void {
    this.selectedItem = null;
    this.menuItemsForm.reset({ isAvailable: true, price: 0 });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
