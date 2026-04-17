import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  FormLabelDirective,
  FormSelectDirective,
  RowComponent
} from '@coreui/angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { Currency } from '../../../core/models/restaurantTablesModel';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-manager-settings',
  standalone: true,
  templateUrl: './manager-settings.component.html',
  styleUrl: './manager-settings.component.scss',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    RowComponent,
    ColComponent,
    FormLabelDirective,
    FormSelectDirective,
    ButtonDirective,
    TranslocoPipe
  ]
})
export class ManagerSettingsComponent implements OnInit {
  private readonly apiUrl = environment.apiUrl;

  readonly fallbackCurrencies = Object.values(Currency) as string[];
  currencyOptions: string[] = [...this.fallbackCurrencies];

  form = this.fb.nonNullable.group({
    currency: ['EUR', Validators.required]
  });

  saving = false;
  canceling = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private miscellaneousService: MiscellaneousService,
    private subscriptionService: SubscriptionService,
    private router: Router,
    private toast: AppToastService,
    private transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    this.miscellaneousService.getCurrencies().subscribe({
      next: list => {
        if (list?.length) {
          this.currencyOptions = list;
        }
      },
      error: () => {
        /* keep fallback */
      }
    });
  }

  get isManager(): boolean {
    return this.authService.getUserRole()?.toLowerCase() === 'manager';
  }

  get restaurantId(): string | null {
    const id = this.authService.getUserRestaurantId();
    return typeof id === 'string' ? id : Array.isArray(id) ? id[0] ?? null : null;
  }

  saveCurrency(): void {
    const rid = this.restaurantId;
    if (!rid || this.form.invalid) {
      return;
    }
    this.saving = true;
    const currency = this.form.getRawValue().currency;
    this.http
      .patch<{ currency: string }>(
        `${this.apiUrl}/api/restaurants/${rid}/admin/currency`,
        { currency },
        { withCredentials: true }
      )
      .subscribe({
        next: () => {
          this.saving = false;
          this.toast.success(
            this.transloco.translate('restaurantSettings.toastSavedBody'),
            this.transloco.translate('restaurantSettings.toastSavedTitle')
          );
        },
        error: err => {
          console.error('Failed to update currency', err);
          this.saving = false;
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.toastCurrencyErrorTitle')
          );
        }
      });
  }

  confirmCancelSubscription(): void {
    if (
      !confirm(this.transloco.translate('restaurantSettings.confirmCancelSubscription'))
    ) {
      return;
    }
    this.canceling = true;
    this.subscriptionService.cancelSubscription().subscribe({
      next: () => {
        this.canceling = false;
        this.authService.logout().subscribe(() => {
          void this.router.navigate(['/login']);
        });
      },
      error: err => {
        console.error('Cancel subscription failed', err);
        this.canceling = false;
      }
    });
  }
}
