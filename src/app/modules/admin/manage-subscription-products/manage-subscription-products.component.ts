import { Component, OnInit, OnDestroy, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CurrencyPipe, NgFor, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
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
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { VenueSizeConfigList } from '../../../core/models/venueSizeConfigModel';


@Component({
  selector: 'app-subscription-products',
  standalone: true,
  imports: [
    NgFor, NgIf, CurrencyPipe, ReactiveFormsModule,
    Tabs2Module, ModalComponent, ModalBodyComponent, ModalHeaderComponent, RouterLink,
    ModalFooterComponent, ModalTitleDirective, ButtonDirective, ButtonCloseDirective,
    FormControlDirective, FormLabelDirective, ToasterComponent, TemplateIdDirective,
    DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
    TranslocoPipe
  ],
  templateUrl: './manage-subscription-products.component.html'
})
export class ManageSubscriptionProductsComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  products: SubscriptionProductModel[] = [];
  selectedProduct: SubscriptionProductModel | null = null;
  restaurantTypes: VenueSizeConfigList = [];
  currencies: string[] = [];

  readonly featureKeys = [
    'pricing.features.cardPayments',
    'pricing.features.qrMenu',
    'pricing.features.callWaiter',
    'pricing.features.reports',
    'pricing.features.bookings',
    'pricing.features.realtimeUpdates',
    'pricing.features.offlineFirst',
  ] as const;


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

  onEdit(product: SubscriptionProductModel): void {
    this.selectedProduct = product;
    this.editForm.patchValue({
      restaurantType: product.restaurantType,
      description: product.description,
      features: product.features,
      priceAmount: product.priceAmount,
      priceCurrency: product.priceCurrency,
      subscriptionInterval: product.subscriptionInterval || 'month',
      usageType: 'licensed'
    });
    this.editModalVisible = true;
  }

  onSaveEdit(): void {
    if (!this.selectedProduct) return;
    if (this.editForm.invalid) return;

    const payload = this.editForm.value;

    this.subscriptionService.updateProduct(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast('Product Updated', `${payload.restaurantType}`, 'success');
          this.editModalVisible = false;
          this.selectedProduct = null;
          this.loadProducts();
        },
        error: (err) => {
          this.addToast('Error', err?.Message ?? 'Failed to update product', 'danger');
        }
      });
  }

  parseFeatureKeys(raw: string | null | undefined): string[] {
    const s = (raw ?? '').trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.filter(x => typeof x === 'string');
    } catch { /* ignore */ }
    return [];
  }

  setFeaturesFromKeys(keys: string[], form: FormGroup): void {
    form.get('features')?.setValue(JSON.stringify(keys));
  }

  toggleFeatureKey(key: string, form: FormGroup): void {
    const current = new Set(this.parseFeatureKeys(form.get('features')?.value));
    if (current.has(key)) current.delete(key);
    else current.add(key);
    this.setFeaturesFromKeys([...current], form);
  }

  hasFeatureKey(key: string, form: FormGroup): boolean {
    return this.parseFeatureKeys(form.get('features')?.value).includes(key);
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
