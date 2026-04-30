import { Component, OnDestroy, OnInit, viewChild } from '@angular/core';
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
import { MenuItem, MenuResponse } from '../../../core/models/menu/menuItem';
import { AuthService } from '../../../core/auth/auth.service';
import { NgFor, NgIf, CurrencyPipe } from '@angular/common';
import { UserContextModel } from '../../../core/models/userContextModel';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
;

@Component({
  selector: 'app-manage-menu',
  imports: [Tabs2Module, FormControlDirective,
    FormLabelDirective,
    NgFor, NgIf, ReactiveFormsModule,
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
    ,
    TranslocoPipe
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

  // readonly toaster = viewChild(ToasterComponent);

  constructor(private menuItemService: MenuItemServiceService,
    private fb: FormBuilder, private authService: AuthService,
    private appToast: AppToastService,
    private transloco: TranslocoService) {
    this.menuItemsForm = this.fb.group({
      menuItemName: ['', Validators.required],
      menuItemDescription: ['', Validators.required],
      menuItemPriceAmount: [0, [Validators.required, Validators.min(0.01)]],
      menuItemCategory: ['', Validators.required],
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
        next: (response: MenuResponse) => {

          // dacă backend-ul trimite un singur meniu, îl luăm pe primul
          const first = response;

          this.menuItems = first?.menu?.menuItems ?? [];
          this.categories = first?.categories ?? [];
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

  toggleAvailability(item: MenuItem): void {
    const next = !(item.isAvailable ?? true);
    this.menuItemService.setAvailability(this.restaurantId, item.menuItemId, next)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          item.isAvailable = next;
          this.appToast.success(
            next
              ? this.transloco.translate('menu.availability.manager.toastAvailable')
              : this.transloco.translate('menu.availability.manager.toastUnavailable')
          );
        },
        error: (error) => {
          this.appToast.error(this.transloco.translate('menu.availability.manager.toastError'));
        }
      });
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
        .subscribe({
          next: () => {
            this.appToast.success(`Menu Item Updated: ${this.menuItemsForm.get('menuItemName')?.value ?? ''}`);
            this.resetForm();
            this.loadMenuItems();
            this.closeEditModal();
          },
          error: (error) => {
            this.appToast.error(`Error updating Menu Item: ${error?.Message}`);
            this.resetForm();
            this.closeEditModal();
            this.loadMenuItems();
          }
        })
    } else {
      this.menuItemService.create(this.restaurantId, formData)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.appToast.success(`Menu Item Created: ${this.menuItemsForm.get('menuItemName')?.value ?? ''}`);
            this.resetForm();
            this.loadMenuItems();
          },
          error: (error) => {
            this.appToast.error(`Error creating Menu Item: ${error?.Message}`);
            this.resetForm();
            this.loadMenuItems();
          }
        });
    }
  }

  onUpdate() {
    if (this.menuItemsForm.valid && this.selectedItem) {
      const updated = { ...this.selectedItem, ...this.menuItemsForm.value, menuItemPriceCurrency: this.selectedItem.menuItemPriceCurrency };
      this.menuItemService.update(this.restaurantId, this.selectedItem.menuItemId, updated)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadMenuItems();
            this.closeEditModal();
            this.resetForm();
            this.appToast.success(`Menu Item Updated: ${updated.menuItemName}`);
          },
          error: (error) => {

            this.closeEditModal();
            this.loadMenuItems();
            this.resetForm();
            this.appToast.error(`Error updating Menu Item: ${error?.Message}`);
          }
        });
      // .subscribe(() => {
      //   this.addToast('Menu Item Updated:', 'Success', 3000, 'success');
      //   this.closeEditModal();
      //   this.loadMenuItems();
      // },
      //   error => {
      //     this.closeEditModal();
      //     this.loadMenuItems();
      //     this.addToast('Error:', error.Message, 5000, 'danger');
      //   });
    }
  }

  ngOnInit(): void {
    this.authService.getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user && !!user.restaurantId),
        take(1)
      )
      .subscribe({
        next: (user) => {
          this.restaurantId = user?.restaurantId ?? '';
          this.loadMenuItems();
        },
        error: (err) => {
          this.appToast.error(`Error fetching menu items: ${err?.Message}`);
        }
      });
  }

  resetForm(): void {
    this.selectedItem = null;
    this.menuItemsForm.reset({ menuItemPriceAmount: 0 });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
