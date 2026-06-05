import { DecimalPipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonCloseDirective,
  ButtonDirective,
  DropdownComponent,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  TableDirective,
  Tabs2Module,
  TemplateIdDirective,
  ToasterComponent
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import {
  RestaurantDetailDTO,
  RestaurantStatisticDTO
} from '../../../core/models/global-admin-restaurant.model';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { VenueSizeConfigList } from '../../../core/models/venueSizeConfigModel';
import { ToastBaseComponent } from '../../../shared/components/toast-base/toast-base.component';

@Component({
  selector: 'app-manage-restaurants',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    DecimalPipe,
    ReactiveFormsModule,
    Tabs2Module,
    TableDirective,
    ModalComponent,
    ModalBodyComponent,
    ModalHeaderComponent,
    ModalFooterComponent,
    ModalTitleDirective,
    ButtonDirective,
    ButtonCloseDirective,
    FormControlDirective,
    FormLabelDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    DropdownComponent,
    DropdownItemDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    ToasterComponent,
    TemplateIdDirective,
    TranslocoPipe
  ],
  templateUrl: './manage-restaurants.component.html'
})
export class ManageRestaurantsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  restaurants: RestaurantStatisticDTO[] = [];
  selectedRestaurant: RestaurantStatisticDTO | null = null;
  detailRestaurant: RestaurantDetailDTO | null = null;

  pageNumber = 1;
  pageSize = 10;
  totalCount = 0;

  restaurantTypes: VenueSizeConfigList = [];
  currencies: string[] = [];

  addForm: FormGroup;
  editForm: FormGroup;

  activeTab = 0;
  loading = false;
  editModalVisible = false;
  deleteModalVisible = false;
  detailsModalVisible = false;
  placement = 'top-end';

  readonly toaster = viewChild(ToasterComponent);

  constructor(
    private fb: FormBuilder,
    private globalAdmin: GlobalAdminService,
    private miscService: MiscellaneousService,
    private transloco: TranslocoService
  ) {
    this.addForm = this.fb.group({
      restaurantName: ['', [Validators.required, Validators.maxLength(200)]],
      restaurantType: ['', Validators.required],
      useCurrency: ['RON', Validators.required]
    });

    this.editForm = this.fb.group({
      restaurantName: ['', [Validators.required, Validators.maxLength(200)]],
      itHasBar: [false]
    });
  }

  ngOnInit(): void {
    this.loadPage();
    this.loadDropdownData();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
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

  loadPage(): void {
    this.loading = true;
    this.globalAdmin.listRestaurants(this.pageNumber, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.restaurants = res.result ?? [];
          this.totalCount = res.totalCount;
          this.loading = false;
        },
        error: err => {
          this.loading = false;
          this.addToast(
            this.transloco.translate('manageRestaurants.errorTitle'),
            err?.error?.message ?? this.transloco.translate('manageRestaurants.loadError'),
            'danger'
          );
        }
      });
  }

  onPrevPage(): void {
    if (this.pageNumber <= 1) return;
    this.pageNumber--;
    this.loadPage();
  }

  onNextPage(): void {
    if (this.pageNumber >= this.totalPages) return;
    this.pageNumber++;
    this.loadPage();
  }

  onAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    const payload = this.addForm.value as {
      restaurantName: string;
      restaurantType: string;
      useCurrency: string;
    };

    this.globalAdmin.createRestaurant(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast(
            this.transloco.translate('manageRestaurants.createSuccessTitle'),
            payload.restaurantName,
            'success'
          );
          this.addForm.reset({ useCurrency: 'RON' });
          this.activeTab = 0;
          this.pageNumber = 1;
          this.loadPage();
        },
        error: err => this.addToast(
          this.transloco.translate('manageRestaurants.errorTitle'),
          err?.error?.message ?? this.transloco.translate('manageRestaurants.createError'),
          'danger'
        )
      });
  }

  onEdit(restaurant: RestaurantStatisticDTO): void {
    this.selectedRestaurant = restaurant;
    this.editForm.patchValue({
      restaurantName: restaurant.baseRestaurantName || restaurant.restaurantName,
      itHasBar: (restaurant.numberOfBars ?? 0) > 0
    });
    this.editModalVisible = true;
  }

  onSaveEdit(): void {
    if (!this.selectedRestaurant || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const payload = this.editForm.value as { restaurantName: string; itHasBar: boolean };

    this.globalAdmin.updateRestaurant(this.selectedRestaurant.restaurantId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast(
            this.transloco.translate('manageRestaurants.updateSuccessTitle'),
            payload.restaurantName,
            'success'
          );
          this.editModalVisible = false;
          this.selectedRestaurant = null;
          this.loadPage();
        },
        error: err => this.addToast(
          this.transloco.translate('manageRestaurants.errorTitle'),
          err?.error?.message ?? this.transloco.translate('manageRestaurants.updateError'),
          'danger'
        )
      });
  }

  onDelete(restaurant: RestaurantStatisticDTO): void {
    this.selectedRestaurant = restaurant;
    this.deleteModalVisible = true;
  }

  onConfirmDelete(): void {
    if (!this.selectedRestaurant) return;

    this.globalAdmin.deleteRestaurant(this.selectedRestaurant.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.addToast(
            this.transloco.translate('manageRestaurants.deleteSuccessTitle'),
            this.selectedRestaurant?.restaurantName ?? '',
            'success'
          );
          this.deleteModalVisible = false;
          this.selectedRestaurant = null;
          if (this.restaurants.length === 1 && this.pageNumber > 1) {
            this.pageNumber--;
          }
          this.loadPage();
        },
        error: err => this.addToast(
          this.transloco.translate('manageRestaurants.errorTitle'),
          err?.error?.message ?? this.transloco.translate('manageRestaurants.deleteError'),
          'danger'
        )
      });
  }

  onDetails(restaurant: RestaurantStatisticDTO): void {
    this.selectedRestaurant = restaurant;
    this.detailRestaurant = null;
    this.detailsModalVisible = true;

    this.globalAdmin.getRestaurant(restaurant.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: detail => this.detailRestaurant = detail,
        error: err => this.addToast(
          this.transloco.translate('manageRestaurants.errorTitle'),
          err?.error?.message ?? this.transloco.translate('manageRestaurants.detailsError'),
          'danger'
        )
      });
  }

  tableCount(detail: RestaurantDetailDTO | null): number {
    return detail?.tables?.length ?? 0;
  }

  barCount(detail: RestaurantDetailDTO | null): number {
    return detail?.bars?.length ?? 0;
  }

  hasMenu(detail: RestaurantDetailDTO | null): boolean {
    return detail?.menu != null;
  }

  addToast(title: string, message: string, color: string): void {
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
