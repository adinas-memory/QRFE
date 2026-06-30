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
  RowComponent,
  AlertComponent,
} from '@coreui/angular';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { Currency } from '../../../core/models/restaurantTablesModel';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  PrintJobsService,
  PrinterAgentInstallationDto,
  PrinterAgentPrinterDto
} from '../../../core/services/print-jobs/print-jobs.service';
import {
  OfflinePrimaryService,
  OfflinePrimaryStaffPolicy,
  RestaurantStaffListItem,
} from '../../../core/services/offline-primary/offline-primary.service';
import { ManagerSubscriptionStatusModel } from '../../../core/models/manager-subscription-status.model';

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
    TranslocoPipe,
    AlertComponent,
  ]
})
export class ManagerSettingsComponent implements OnInit, OnDestroy {
  private static readonly scheduledCancelStorageKey = 'managerSubscriptionScheduledCancel';
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
  loadingSubscriptionStatus = false;
  subscriptionStatusLoadFailed = false;
  subscriptionStatus: ManagerSubscriptionStatusModel | null = null;

  enrollmentCodes: PrinterAgentEnrollmentCodeRow[] = [];
  loadingEnrollmentCodes = false;
  generatingEnrollmentCode = false;
  lastGeneratedCode: string | null = null;

  agentInstallations: PrinterAgentInstallationDto[] = [];
  loadingAgentInstallations = false;
  removingAgentId: string | null = null;

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

  offlinePrimaryStaff: RestaurantStaffListItem[] = [];
  offlinePrimaryPolicy: OfflinePrimaryStaffPolicy | null = null;
  selectedOfflinePrimaryStaffUserId: string | null = null;
  loadingOfflinePrimary = false;
  savingOfflinePrimary = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private miscellaneousService: MiscellaneousService,
    private subscriptionService: SubscriptionService,
    private router: Router,
    private toast: AppToastService,
    private transloco: TranslocoService,
    private printJobs: PrintJobsService,
    private offlinePrimary: OfflinePrimaryService,
  ) {}

  ngOnInit(): void {
    // #region agent log
    const snap = this.authService.getUserSnapshot();
    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '38fcde' },
      body: JSON.stringify({
        sessionId: '38fcde',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'manager-settings.component.ts:ngOnInit',
        message: 'settings page init',
        data: {
          restaurantId: this.restaurantId,
          rawRestaurantId: snap?.restaurantId ?? null,
          userId: snap?.id ?? null,
          role: snap?.role ?? null,
          apiUrl: this.apiUrl,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    this.loadAgentInstallations();
    this.loadStripeConnectStatus();
    this.loadBillPrinters();
    this.loadOfflinePrimaryStaff();
    if (this.isManager) {
      this.loadManagerSubscriptionStatus();
    }
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

  get subscriptionEndsAt(): Date | null {
    const raw = this.subscriptionStatus?.cancelAtUtc;
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  get isSubscriptionScheduledForCancel(): boolean {
    return !!this.subscriptionStatus?.cancelAtPeriodEnd;
  }

  loadManagerSubscriptionStatus(): void {
    if (!this.isManager) {
      return;
    }
    this.loadingSubscriptionStatus = true;
    this.subscriptionStatusLoadFailed = false;
    this.subscriptionService.getManagerSubscriptionStatus().subscribe({
      next: status => {
        this.subscriptionStatus = status;
        this.loadingSubscriptionStatus = false;
        this.subscriptionStatusLoadFailed = false;
        if (!status.cancelAtPeriodEnd) {
          this.clearScheduledCancel();
        }
      },
      error: err => {
        console.error('Failed to load subscription status', err);
        this.loadingSubscriptionStatus = false;
        const httpStatus = (err as { status?: number })?.status;
        // Status endpoint not deployed yet — keep cancel UI, avoid blocking red error.
        if (httpStatus === 404) {
          const preservedFromMemory = this.subscriptionStatus?.cancelAtPeriodEnd === true;
          const stored = this.readScheduledCancel();
          this.subscriptionStatus = preservedFromMemory
            ? this.subscriptionStatus!
            : stored ?? {
                subscriptionStatus: 'active',
                cancelAtPeriodEnd: false,
                cancelAtUtc: null,
              };
          this.subscriptionStatusLoadFailed = false;
          return;
        }
        this.subscriptionStatusLoadFailed = true;
      },
    });
  }

  formatSubscriptionEndDate(value: Date | null): string {
    if (!value) {
      return '';
    }
    return value.toLocaleDateString(this.transloco.getActiveLang(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  loadOfflinePrimaryStaff(): void {
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    this.loadingOfflinePrimary = true;
    forkJoin({
      staff: this.offlinePrimary.listStaff(rid).pipe(
        catchError(err => {
          console.error('Failed to load staff list', err);
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.offlinePrimaryStaff.loadError'),
          );
          return of([] as RestaurantStaffListItem[]);
        }),
      ),
      policy: this.offlinePrimary.getPolicy(rid).pipe(
        catchError(err => {
          console.error('Failed to load offline primary policy', err);
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.offlinePrimaryStaff.loadError'),
          );
          return of(null as OfflinePrimaryStaffPolicy | null);
        }),
      ),
    }).subscribe({
      next: ({ staff, policy }) => {
        this.offlinePrimaryStaff = staff ?? [];
        this.offlinePrimaryPolicy = policy;
        this.selectedOfflinePrimaryStaffUserId = policy?.offlinePrimaryStaffUserId ?? null;
        this.loadingOfflinePrimary = false;
      },
      error: () => {
        this.loadingOfflinePrimary = false;
      },
    });
  }

  saveOfflinePrimaryStaff(): void {
    const rid = this.restaurantId;
    if (!rid) {
      return;
    }
    const previousUserId = this.offlinePrimaryPolicy?.offlinePrimaryStaffUserId ?? null;
    const nextUserId = this.selectedOfflinePrimaryStaffUserId;
    this.savingOfflinePrimary = true;
    this.offlinePrimary.updatePolicy(rid, nextUserId).subscribe({
      next: policy => {
        this.offlinePrimaryPolicy = policy;
        this.selectedOfflinePrimaryStaffUserId = policy.offlinePrimaryStaffUserId;
        this.savingOfflinePrimary = false;
        this.toast.success(
          previousUserId !== nextUserId && nextUserId
            ? this.transloco.translate('restaurantSettings.offlinePrimaryStaff.toastSavedRebindBody')
            : this.transloco.translate('restaurantSettings.offlinePrimaryStaff.toastSavedBody'),
          this.transloco.translate('restaurantSettings.offlinePrimaryStaff.toastSavedTitle'),
        );
      },
      error: err => {
        console.error('Failed to save offline primary staff', err);
        this.savingOfflinePrimary = false;
        this.toast.error(
          this.miscellaneousService.getFirstErrorMessage(err),
          this.transloco.translate('restaurantSettings.offlinePrimaryStaff.saveError'),
        );
      },
    });
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
        error: (err: unknown) => {
          console.error('Failed to delete enrollment code', err);
          this.toast.error(
            this.miscellaneousService.getFirstErrorMessage(err),
            this.transloco.translate('restaurantSettings.printerAgentEnrollment.deleteError')
          );
        }
      });
  }

  loadAgentInstallations(): void {
    const rid = this.restaurantId;
    if (!rid) return;
    this.loadingAgentInstallations = true;
    this.printJobs.listAgentInstallations(rid).subscribe({
      next: rows => {
        this.agentInstallations = rows ?? [];
        this.loadingAgentInstallations = false;
      },
      error: err => {
        console.error('Failed to load agent installations', err);
        this.loadingAgentInstallations = false;
        this.toast.error(
          this.miscellaneousService.getFirstErrorMessage(err),
          this.transloco.translate('restaurantSettings.printerAgentEnrollment.installationsLoadError'),
        );
      },
    });
  }

  removeAgentInstallation(agentId: string): void {
    if (!confirm(this.transloco.translate('restaurantSettings.printerAgentEnrollment.installationsRemoveConfirm'))) {
      return;
    }
    const rid = this.restaurantId;
    if (!rid) return;
    this.removingAgentId = agentId;
    this.printJobs.removeAgentInstallation(rid, agentId).subscribe({
      next: () => {
        this.removingAgentId = null;
        this.loadAgentInstallations();
        this.fetchBillPrinters({ silent: true });
        this.toast.success(
          this.transloco.translate('restaurantSettings.printerAgentEnrollment.installationsRemovedBody'),
          this.transloco.translate('restaurantSettings.printerAgentEnrollment.installationsRemovedTitle'),
        );
      },
      error: err => {
        console.error('Failed to remove agent installation', err);
        this.removingAgentId = null;
        this.toast.error(
          this.miscellaneousService.getFirstErrorMessage(err),
          this.transloco.translate('restaurantSettings.printerAgentEnrollment.installationsRemoveError'),
        );
      },
    });
  }

  formatPrinterIds(ids: string[] | null | undefined): string {
    if (!ids?.length) return '—';
    return ids.join(', ');
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
        // #region agent log
        fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '38fcde' },
          body: JSON.stringify({
            sessionId: '38fcde',
            runId: 'pre-fix',
            hypothesisId: 'C_D',
            location: 'manager-settings.component.ts:fetchBillPrinters',
            message: 'bill printers merged',
            data: {
              restaurantId: this.restaurantId,
              billPrinterCount: this.billPrinters.length,
              billPrinterIds: this.billPrinters.map(p => p.id),
              defaultBillPrinterId: this.defaultBillPrinterId,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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

  private persistScheduledCancel(status: ManagerSubscriptionStatusModel): void {
    if (!status.cancelAtPeriodEnd) {
      return;
    }
    sessionStorage.setItem(
      ManagerSettingsComponent.scheduledCancelStorageKey,
      JSON.stringify(status),
    );
  }

  private readScheduledCancel(): ManagerSubscriptionStatusModel | null {
    try {
      const raw = sessionStorage.getItem(ManagerSettingsComponent.scheduledCancelStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as ManagerSubscriptionStatusModel;
      return parsed.cancelAtPeriodEnd ? parsed : null;
    } catch {
      return null;
    }
  }

  private clearScheduledCancel(): void {
    sessionStorage.removeItem(ManagerSettingsComponent.scheduledCancelStorageKey);
  }

  confirmCancelSubscription(): void {
    if (
      !confirm(this.transloco.translate('restaurantSettings.confirmCancelSubscription'))
    ) {
      return;
    }
    this.canceling = true;
    this.subscriptionService.cancelSubscription().subscribe({
      next: res => {
        this.canceling = false;
        this.subscriptionStatus = {
          subscriptionStatus: res.subscriptionStatus,
          cancelAtPeriodEnd: res.cancelAtPeriodEnd || true,
          cancelAtUtc: res.cancelAtUtc,
        };
        this.subscriptionStatusLoadFailed = false;
        this.persistScheduledCancel(this.subscriptionStatus);
        const formattedDate = this.formatSubscriptionEndDate(this.subscriptionEndsAt);
        this.toast.success(
          formattedDate
            ? this.transloco.translate('restaurantSettings.cancelSubscriptionSuccessBody', { date: formattedDate })
            : this.transloco.translate('restaurantSettings.cancelSubscriptionSuccessBodyNoDate'),
          this.transloco.translate('restaurantSettings.cancelSubscriptionSuccessTitle'),
        );
        this.loadManagerSubscriptionStatus();
      },
      error: err => {
        console.error('Cancel subscription failed', err);
        this.canceling = false;
        this.toast.error(
          this.miscellaneousService.getFirstErrorMessage(err),
          this.transloco.translate('restaurantSettings.cancelSubscriptionErrorTitle'),
        );
      },
    });
  }
}
