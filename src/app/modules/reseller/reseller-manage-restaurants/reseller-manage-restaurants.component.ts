import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective,
  RowComponent
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { ResellerService } from '../../../core/services/reseller-service/reseller.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { VenueSizeConfigList } from '../../../core/models/venueSizeConfigModel';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { emailFieldValidators } from '../../../core/validators/email.validator';

@Component({
  selector: 'app-reseller-manage-restaurants',
  standalone: true,
  imports: [
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardGroupComponent,
    CardComponent,
    CardBodyComponent,
    FormDirective,
    FormLabelDirective,
    FormControlDirective,
    FormSelectDirective,
    ButtonDirective,
    ReactiveFormsModule,
    TranslocoPipe
  ],
  templateUrl: './reseller-manage-restaurants.component.html'
})
export class ResellerManageRestaurantsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  addForm: FormGroup;
  restaurantTypes: VenueSizeConfigList = [];
  currencies: string[] = [];
  submitting = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly reseller: ResellerService,
    private readonly miscService: MiscellaneousService,
    private readonly toast: AppToastService,
    private readonly transloco: TranslocoService,
    private readonly router: Router
  ) {
    this.addForm = this.fb.group({
      restaurantName: ['', [Validators.required, Validators.maxLength(200)]],
      restaurantType: ['', Validators.required],
      useCurrency: ['RON', Validators.required],
      name: ['', [Validators.required, Validators.maxLength(100)]],
      surname: ['', [Validators.required, Validators.maxLength(100)]],
      email: ['', emailFieldValidators],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: [''],
      city: [''],
      country: [''],
      address: [''],
      registrationNumber: ['', [Validators.required, Validators.maxLength(50)]],
      zip: ['', Validators.maxLength(20)]
    });
  }

  ngOnInit(): void {
    this.miscService.getRestaurantLimits()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: limits => (this.restaurantTypes = limits) });

    this.miscService.getCurrencies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: currencies => (this.currencies = currencies) });
  }

  onSubmit(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const payload = this.addForm.value as {
      restaurantName: string;
      restaurantType: string;
      useCurrency: string;
      name: string;
      surname: string;
      email: string;
      password: string;
      phone: string;
      city: string;
      country: string;
      address: string;
      registrationNumber: string;
      zip: string;
    };

    this.reseller.provisionRestaurantWithManager(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.submitting = false;
          if (res.isSuccess) {
            this.toast.success(
              res.message ?? payload.restaurantName,
              this.transloco.translate('resellerManageRestaurants.successTitle')
            );
            void this.router.navigate(['/reseller/dashboard']);
          } else {
            this.toast.error(this.transloco.translate('resellerManageRestaurants.errorGeneric'));
          }
        },
        error: () => {
          this.submitting = false;
          this.toast.error(this.transloco.translate('resellerManageRestaurants.errorGeneric'));
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
