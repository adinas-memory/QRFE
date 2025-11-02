import { Component, OnDestroy, OnInit, viewChild, ViewChild } from '@angular/core';
import {
  Tabs2Module, FormControlDirective,
  FormLabelDirective, AccordionButtonDirective,
  AccordionComponent, AccordionItemComponent,
  ToasterComponent, TemplateIdDirective,
  ToasterPlacement,
  FormSelectDirective,
  ButtonDirective,
  ButtonCloseDirective,
  ModalBodyComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  ModalComponent
} from '@coreui/angular';
import { } from '@coreui/angular';
import { MenuItemServiceService } from '../../../core/services/menu-item-service/menu-item-service.service';
import { filter, Subject, take, takeUntil } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MenuItem } from '../../../core/models/menu/menuItem';
import { AuthService } from '../../../core/auth/auth.service';
import { NgFor, CurrencyPipe, DatePipe } from '@angular/common';
import { UserContextModel } from '../../../core/models/userContextModel';
import { ToastBaseComponent } from '../../../shared/components/toast-base/toast-base.component';
;

@Component({
  selector: 'app-manage-menu',
  imports: [Tabs2Module, FormControlDirective,
    FormLabelDirective,
    NgFor, ReactiveFormsModule,
    AccordionButtonDirective,
    AccordionComponent, AccordionItemComponent,
    TemplateIdDirective, CurrencyPipe,
    ToasterComponent, FormSelectDirective,
    ButtonDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent
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
  placement = ToasterPlacement.TopEnd;
  editModalVisible = false;
  forceRefreshAfterUpdate = Date.now();

  readonly toaster = viewChild(ToasterComponent);

  constructor(private menuItemService: MenuItemServiceService,
    private fb: FormBuilder, private authService: AuthService,
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
      .subscribe(cats => { this.categories = cats ?? []; });
  }

  onEdit(item: MenuItem): void {
    this.selectedItem = item;
    // this.menuItemsForm.patchValue(item);
    this.menuItemsForm.patchValue({
      menuItemName: item.menuItemName,
      menuItemDescription: item.menuItemDescription,
      menuItemPriceAmount: item.menuItemPriceAmount,
      menuItemCategory: item.category, // map correctly
      menuItemIcon: null // don’t prefill file input
    });
    this.editModalVisible = true;
  }

  closeEditModal() {
    this.editModalVisible = false;
    this.selectedItem = null;
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
  formData.append('menuItemName', this.menuItemsForm.value.menuItemName);
  formData.append('menuItemDescription', this.menuItemsForm.value.menuItemDescription);
  formData.append('menuItemPriceAmount', this.menuItemsForm.value.menuItemPriceAmount);
  formData.append('menuItemCategory', this.menuItemsForm.value.menuItemCategory.toString());

  if (this.selectedFile) {
    formData.append('menuItemIcon', this.selectedFile);
  }

  if (this.selectedItem) {
    this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.addToast('Menu Item Updated:', 'Success', 3000, 'success');
        this.resetForm();
        this.loadMenuItems();
        this.closeEditModal();
      }, error => {
        this.addToast('Error:', error.Message, 5000, 'danger');
      });
  } else {
    this.menuItemService.create(this.restaurantId, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.addToast('Menu Item Created:', this.menuItemsForm.get('menuItemName')?.value ?? '', 3000, 'success');
        this.resetForm();
        this.loadMenuItems();
      }, error => {
        this.addToast('Error:', error.Message, 5000, 'danger');
      });
  }
}


  // onSubmit(): void {
  //   const formData = new FormData();
  //   // append all form fields
  //   formData.append('menuItemName', this.menuItemsForm.value.menuItemName);
  //   formData.append('menuItemDescription', this.menuItemsForm.value.menuItemDescription);
  //   formData.append('menuItemPriceAmount', this.menuItemsForm.value.menuItemPriceAmount);
  //   formData.append('menuItemCategory', this.menuItemsForm.value.menuItemCategory);
  //   // if a file was selected, append it
  //   if (this.selectedFile) {
  //     formData.append('menuItemIcon', this.selectedFile);
  //   }

  //   if (this.selectedItem) {
  //     console.log('Updating item:', this.selectedItem.menuItemId);
  //     // update existing item
  //     this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, formData)
  //       .pipe(takeUntil(this.destroy$))
  //       .subscribe(() => {
  //         this.addToast('Menu Item Created:', this.menuItemsForm.get('menuItemName')?.value
  //           ?? '', 3000, 'success');
  //         this.resetForm();
  //         this.loadMenuItems();
  //         this.closeEditModal();
  //       }, error => {
  //         this.addToast('Error:', error.Message, 5000, 'danger');
  //       });
  //   } else {
  //     // create new item
  //     this.menuItemService.create(this.restaurantId, formData)
  //       .pipe(takeUntil(this.destroy$))
  //       .subscribe(() => {
  //         this.addToast('Menu Item Created:', this.menuItemsForm.get('menuItemName')?.value
  //           ?? '', 3000, 'success')
  //         this.resetForm();
  //         this.loadMenuItems();

  //       }, error => {
  //         this.addToast('Error:', error.Message, 5000, 'danger');
  //       });
  //   }
  // }

  // private updateMenuItem(formData: FormData) {
  //   this.menuItemService.update(this.restaurantId, this.selectedItem?.menuItemId ?? '', formData)
  //     .pipe(takeUntil(this.destroy$))
  //     .subscribe(() => {
  //       this.addToast('Menu Item Updated:', 'Success', 3000, 'success');
  //       this.resetForm();
  //       this.loadMenuItems();
  //       this.closeEditModal();
  //     }, error => {
  //       this.addToast('Error:', error.Message, 5000, 'danger');
  //     });
  // }

  onUpdate() {
    if (this.menuItemsForm.valid && this.selectedItem) {
      const updated = { ...this.selectedItem, ...this.menuItemsForm.value, menuItemPriceCurrency: this.selectedItem.menuItemPriceCurrency };
      this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, updated)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.addToast('Menu Item Updated:', 'Success', 3000, 'success');
          this.closeEditModal();
          this.loadMenuItems();
        },
          error => {
            this.closeEditModal();
            this.loadMenuItems();
            this.addToast('Error:', error.Message, 5000, 'danger');
          });
    }
  }

  addToast(title: string, message: string, delay: number, color: string) {
    const options = {
      title: title,
      delay: delay,
      message: message,
      placement: this.placement,
      color: color,
      autohide: true
    };
    const componentRef = this.toaster()?.addToast(ToastBaseComponent, { ...options });
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
