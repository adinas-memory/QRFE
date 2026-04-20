import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
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

export interface PrinterAgentEnrollmentCodeRow {
  id: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  usesRemaining: number;
  revoked: boolean;
}

@Component({
  selector: 'app-manager-settings',
  standalone: true,
  templateUrl: './manager-settings.component.html',
  styleUrl: './manager-settings.component.scss',
  imports: [
    ReactiveFormsModule,
    DatePipe,
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

  enrollmentCodes: PrinterAgentEnrollmentCodeRow[] = [];
  loadingEnrollmentCodes = false;
  generatingEnrollmentCode = false;
  lastGeneratedCode: string | null = null;

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
    this.loadEnrollmentCodes();
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

  loadEnrollmentCodes(): void {
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    this.loadingEnrollmentCodes = true;
    this.http
      .get<PrinterAgentEnrollmentCodeRow[]>(
        `${this.apiUrl}/api/restaurants/${rid}/admin/printer-agent/enrollment-codes`,
        { withCredentials: true }
      )
      .subscribe({
        next: rows => {
          this.enrollmentCodes = rows ?? [];
          this.loadingEnrollmentCodes = false;
        },
        error: err => {
          console.error('Failed to load enrollment codes', err);
          this.loadingEnrollmentCodes = false;
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.loadError')
          );
        }
      });
  }

  generateEnrollmentCode(): void {
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    this.generatingEnrollmentCode = true;
    this.lastGeneratedCode = null;
    this.http
      .post<{ code: string; id: string; expiresAtUtc: string }>(
        `${this.apiUrl}/api/restaurants/${rid}/admin/printer-agent/enrollment-codes`,
        { expiresInDays: 14, usesRemaining: 1 },
        { withCredentials: true }
      )
      .subscribe({
        next: res => {
          this.generatingEnrollmentCode = false;
          this.lastGeneratedCode = res.code;
          this.loadEnrollmentCodes();
          this.toast.success(
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.toastGeneratedBody'),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.toastGeneratedTitle')
          );
        },
        error: err => {
          console.error('Failed to generate enrollment code', err);
          this.generatingEnrollmentCode = false;
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.generateError')
          );
        }
      });
  }

  revokeEnrollmentCode(codeId: string): void {
    if (!confirm(this.transloco.translate('restaurantSettings.printerAgentEnrollment.revokeConfirm'))) {
      return;
    }
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    this.http
      .delete(`${this.apiUrl}/api/restaurants/${rid}/admin/printer-agent/enrollment-codes/${codeId}`, {
        withCredentials: true
      })
      .subscribe({
        next: () => {
          this.loadEnrollmentCodes();
        },
        error: err => {
          console.error('Failed to revoke enrollment code', err);
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.revokeError')
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
