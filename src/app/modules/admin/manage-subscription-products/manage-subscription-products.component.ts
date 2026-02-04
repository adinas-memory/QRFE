import { Component, OnInit, OnDestroy, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Tabs2Module, ModalComponent, ModalBodyComponent, ModalHeaderComponent,
  ModalFooterComponent, ModalTitleDirective, ButtonDirective, ButtonCloseDirective,
  FormControlDirective, FormLabelDirective, ToasterComponent, TemplateIdDirective,
  DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective
} from '@coreui/angular';
import { Subject, takeUntil } from 'rxjs';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { CreateSubscriptionProductModel } from '../../../core/models/subscription-product';
import { ToastBaseComponent } from '../../../shared/components/toast-base/toast-base.component';
import { SubscriptionProductModel } from '../../../core/models/subscription-product';
import { MiscellaneousService } from 'src/app/core/services/misc/miscellaneous.service';
import { VenueSizeConfigList } from 'src/app/core/models/venueSizeConfigModel';


@Component({
  selector: 'app-subscription-products',
  standalone: true,
  imports: [
    NgFor, NgIf, ReactiveFormsModule,
    Tabs2Module, ModalComponent, ModalBodyComponent, ModalHeaderComponent, RouterLink,
    ModalFooterComponent, ModalTitleDirective, ButtonDirective, ButtonCloseDirective,
    FormControlDirective, FormLabelDirective, ToasterComponent, TemplateIdDirective,
    DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective
  ],
  templateUrl: './manage-subscription-products.component.html'
})
export class ManageSubscriptionProductsComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  products: SubscriptionProductModel[] = [];
  selectedProduct: CreateSubscriptionProductModel | null = null;
  restaurantTypes: VenueSizeConfigList = [];
  currencies: string[] = [];


  addForm: FormGroup;
  editForm: FormGroup;

  editModalVisible = false;
  placement = 'top-end';
  readonly toaster = viewChild(ToasterComponent);

  constructor(
    private fb: FormBuilder,
    private subscriptionService: SubscriptionService,
    private miscService: MiscellaneousService
  ) {
    this.addForm = this.fb.group({
      restaurantType: ['', Validators.required],
      description: ['', Validators.required],
      features: ['', Validators.required],
      priceAmount: [0, [Validators.required, Validators.min(1)]],
      priceCurrency: ['RON', Validators.required],
      subscriptionInterval: ['month', Validators.required],
      usageType: ['licensed', Validators.required]
    });

    this.editForm = this.fb.group({
      restaurantType: ['', Validators.required],
      description: ['', Validators.required],
      features: ['', Validators.required],
      priceAmount: [0, [Validators.required, Validators.min(1)]],
      priceCurrency: ['', Validators.required],
      subscriptionInterval: ['month', Validators.required],
      usageType: ['licensed', Validators.required]
    });
  }
  ngOnInit(): void {
    this.loadProducts();
    this.loadDropdownData();
  }

  loadDropdownData(): void {
    this.miscService.getRestaurantLimits()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: limits => this.restaurantTypes = limits,
        error: err => console.error('Failed to load restaurant limits', err)
      });

    this.miscService.getCurrencies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: currencies => this.currencies = currencies,
        error: err => console.error('Failed to load currencies', err)
      });
  }


  loadProducts(): void {
    this.subscriptionService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: products => this.products = products,
        error: err => console.error('Failed to load products', err)
      });
  }

  onAdd(): void {
    if (this.addForm.invalid) return;

    const payload = this.addForm.value;

    this.subscriptionService.createProduct(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast('Product Created', payload.restaurantType, 'success');
          this.addForm.reset();
          this.loadProducts();
        },
        error: err => this.addToast('Error', err?.Message ?? 'Failed to create product', 'danger')
      });
  }

  onEdit(product: CreateSubscriptionProductModel): void {
    this.selectedProduct = product;
    this.editForm.patchValue(product);
    this.editModalVisible = true;
  }

  onSaveEdit(): void {
    if (!this.selectedProduct) return;

    const payload = this.editForm.value;

    // aici vei apela endpointul de update
    console.log('UPDATE PRODUCT', payload);

    this.addToast('Product Updated', payload.restaurantType, 'success');
    this.editModalVisible = false;
    this.loadProducts();
  }

  addToast(title: string, message: string, color: string) {
    this.toaster()?.addToast(ToastBaseComponent, {
      title,
      message,
      color,
      delay: 3000,
      placement: this.placement,
      autohide: true
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
