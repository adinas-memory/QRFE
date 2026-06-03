import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, interval, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
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
import { PrintJobsService, PrinterAgentPrinterDto } from '../../../core/services/print-jobs/print-jobs.service';

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
    FormsModule,
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
export class ManagerSettingsComponent implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;
  private static readonly billPrinterPollIntervalMs = 30_000;
  /** Faster polling while waiting for first printer or fixing a default/id mismatch. */
  private static readonly billPrinterPollFastIntervalMs = 10_000;

  private billPrinterPollSub: Subscription | null = null;
  private activeBillPrinterPollMs = 0;
  readonly printerAgentDownloadUrl = environment.printerAgentDownloadUrl?.trim() ?? '';

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

  stripeConnectLoading = false;
  stripeConnectStatus: string | null = null;
  stripeConnectedAccountId: string | null = null;
  stripeChargesEnabled = false;
  stripePayoutsEnabled = false;
  stripeDetailsSubmitted = false;

  billPrinters: PrinterAgentPrinterDto[] = [];
  loadingBillPrinters = false;
  /** True while the bill-printer section auto-refreshes on an interval. */
  billPrintersAutoRefreshActive = false;
  savingDefaultBillPrinter = false;
  defaultBillPrinterId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private miscellaneousService: MiscellaneousService,
    private subscriptionService: SubscriptionService,
    private router: Router,
    private toast: AppToastService,
    private transloco: TranslocoService,
    private printJobs: PrintJobsService
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
    this.loadStripeConnectStatus();
    this.loadBillPrinters();
  }

  ngOnDestroy(): void {
    this.stopBillPrinterPolling();
  }

  get isManager(): boolean {
    return this.authService.getUserRole()?.toLowerCase() === 'manager';
  }

  get restaurantId(): string | null {
    const id = this.authService.getUserRestaurantId();
    return typeof id === 'string' ? id : Array.isArray(id) ? id[0] ?? null : null;
  }

  /** Saved default is set but not present in the latest agent heartbeat list. */
  get isDefaultBillPrinterMismatch(): boolean {
    const id = this.defaultBillPrinterId;
    if (!id || this.billPrinters.length === 0) {
      return false;
    }
    return !this.billPrinters.some(p => p.id === id);
  }

  /** Printers from agent heartbeat, plus a synthetic row when DB has a default id not yet in the list. */
  get billPrinterOptions(): PrinterAgentPrinterDto[] {
    const list = [...this.billPrinters];
    const id = this.defaultBillPrinterId;
    if (id && !list.some(p => p.id === id)) {
      list.unshift({
        id,
        name: this.transloco.translate('restaurantSettings.billPrinter.pendingPrinterName'),
        ipAddress: '',
        port: 0
      });
    }
    return list;
  }

  loadStripeConnectStatus(): void {
    const rid = this.restaurantId;
    if (!rid) return;

    this.stripeConnectLoading = true;
    this.http
      .get<{
        restaurantId: string;
        stripeConnectStatus: string;
        stripeConnectedAccountId: string | null;
        stripeChargesEnabled: boolean;
        stripePayoutsEnabled: boolean;
        stripeDetailsSubmitted: boolean;
      }>(`${this.apiUrl}/api/stripe-connect/status?restaurantId=${encodeURIComponent(rid)}`, { withCredentials: true })
      .subscribe({
        next: res => {
          this.stripeConnectStatus = res?.stripeConnectStatus ?? null;
          this.stripeConnectedAccountId = res?.stripeConnectedAccountId ?? null;
          this.stripeChargesEnabled = !!res?.stripeChargesEnabled;
          this.stripePayoutsEnabled = !!res?.stripePayoutsEnabled;
          this.stripeDetailsSubmitted = !!res?.stripeDetailsSubmitted;
          this.stripeConnectLoading = false;
        },
        error: err => {
          console.error('Failed to load Stripe Connect status', err);
          this.stripeConnectLoading = false;
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.paymentsStripeConnectErrorTitle')
          );
        }
      });
  }

  connectStripe(): void {
    const rid = this.restaurantId;
    if (!rid) return;
    // Redirect to backend which redirects to Stripe OAuth.
    window.location.href = `${this.apiUrl}/api/stripe-connect/authorize?restaurantId=${encodeURIComponent(rid)}`;
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

  deleteEnrollmentCode(codeId: string): void {
    if (!confirm(this.transloco.translate('restaurantSettings.printerAgentEnrollment.deleteConfirm'))) {
      return;
    }
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    this.http
      .delete(`${this.apiUrl}/api/restaurants/${rid}/admin/printer-agent/enrollment-codes/${codeId}/delete`, {
        withCredentials: true
      })
      .subscribe({
        next: () => {
          this.loadEnrollmentCodes();
          this.toast.success(
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.toastDeletedBody'),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.toastDeletedTitle'),
          );
        },
        error: err => {
          console.error('Failed to delete enrollment code', err);
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.deleteError')
          );
        }
      });
  }

  loadBillPrinters(): void {
    this.fetchBillPrinters({ silent: false });
  }

  private fetchBillPrinters(options: { silent: boolean }): void {
    const rid = this.restaurantId;
    if (!rid) return;

    if (!options.silent) {
      this.loadingBillPrinters = true;
    }

    forkJoin({
      printers: this.printJobs.listAgentPrinters(rid).pipe(
        catchError(err => {
          console.error('Failed to load agent printers', err);
          return of([] as PrinterAgentPrinterDto[]);
        })
      ),
      defaults: this.printJobs.getDefaultBillPrinter(rid).pipe(
        catchError(() => of({ defaultBillPrinterId: null as string | null }))
      )
    }).subscribe({
      next: ({ printers, defaults }) => {
        this.billPrinters = printers ?? [];
        this.defaultBillPrinterId = defaults?.defaultBillPrinterId ?? null;
        this.loadingBillPrinters = false;
        this.maybeAutoSelectBillPrinter();
        this.syncBillPrinterPolling();
      },
      error: () => {
        this.loadingBillPrinters = false;
      }
    });
  }

  /** Pre-select the sole agent printer when the saved default is missing or invalid. */
  private maybeAutoSelectBillPrinter(): void {
    if (this.billPrinters.length !== 1) {
      return;
    }
    const onlyId = this.billPrinters[0].id;
    if (!this.defaultBillPrinterId || this.isDefaultBillPrinterMismatch) {
      this.defaultBillPrinterId = onlyId;
    }
  }

  private syncBillPrinterPolling(): void {
    if (!this.restaurantId) {
      this.stopBillPrinterPolling();
      return;
    }

    const intervalMs = this.billPrinters.length === 0 || this.isDefaultBillPrinterMismatch
      ? ManagerSettingsComponent.billPrinterPollFastIntervalMs
      : ManagerSettingsComponent.billPrinterPollIntervalMs;

    if (this.billPrinterPollSub && this.activeBillPrinterPollMs === intervalMs) {
      this.billPrintersAutoRefreshActive = true;
      return;
    }

    this.stopBillPrinterPolling();
    this.activeBillPrinterPollMs = intervalMs;
    this.billPrintersAutoRefreshActive = true;
    this.billPrinterPollSub = interval(intervalMs).subscribe(() => {
      if (!this.loadingBillPrinters) {
        this.fetchBillPrinters({ silent: true });
      }
    });
  }

  private stopBillPrinterPolling(): void {
    this.billPrinterPollSub?.unsubscribe();
    this.billPrinterPollSub = null;
    this.activeBillPrinterPollMs = 0;
    this.billPrintersAutoRefreshActive = false;
  }

  saveDefaultBillPrinter(): void {
    const rid = this.restaurantId;
    if (!rid) return;
    this.savingDefaultBillPrinter = true;

    this.printJobs.updateDefaultBillPrinter(rid, this.defaultBillPrinterId).subscribe({
      next: res => {
        this.defaultBillPrinterId = res?.defaultBillPrinterId ?? null;
        this.savingDefaultBillPrinter = false;
        this.syncBillPrinterPolling();
        this.toast.success(
          this.transloco.translate('restaurantSettings.billPrinter.toastSavedBody'),
          this.transloco.translate('restaurantSettings.billPrinter.toastSavedTitle'),
        );
      },
      error: err => {
        console.error('Failed to save default bill printer', err);
        this.savingDefaultBillPrinter = false;
        const detail =
          this.miscellaneousService.getFirstErrorMessage(err) ||
          this.transloco.translate('restaurantSettings.billPrinter.toastErrorBody');
        this.toast.error(detail, this.transloco.translate('restaurantSettings.billPrinter.toastErrorTitle'));
      }
    });
  }

  stripeConnectStatusLabel(status: string | null): string {
    if (!status) {
      return '—';
    }
    const key = this.stripeConnectStatusTranslationKey(status);
    return key ? this.transloco.translate(key) : status;
  }

  stripeChargesFlagLabel(): string {
    return this.transloco.translate(
      this.stripeChargesEnabled
        ? 'restaurantSettings.paymentsFlagChargesEnabled'
        : 'restaurantSettings.paymentsFlagChargesDisabled',
    );
  }

  stripePayoutsFlagLabel(): string {
    return this.transloco.translate(
      this.stripePayoutsEnabled
        ? 'restaurantSettings.paymentsFlagPayoutsEnabled'
        : 'restaurantSettings.paymentsFlagPayoutsDisabled',
    );
  }

  stripeDetailsFlagLabel(): string {
    return this.transloco.translate(
      this.stripeDetailsSubmitted
        ? 'restaurantSettings.paymentsFlagDetailsSubmitted'
        : 'restaurantSettings.paymentsFlagDetailsMissing',
    );
  }

  private stripeConnectStatusTranslationKey(status: string): string | null {
    const normalized = status.trim().toLowerCase().replace(/-/g, '_');
    const keys: Record<string, string> = {
      not_connected: 'restaurantSettings.paymentsStatusNotConnected',
      connected: 'restaurantSettings.paymentsStatusConnected',
      pending: 'restaurantSettings.paymentsStatusPending',
    };
    return keys[normalized] ?? null;
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
