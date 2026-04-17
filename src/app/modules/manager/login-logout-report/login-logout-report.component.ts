import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardHeaderComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormLabelDirective,
  RowComponent,
  TableDirective
} from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginLogoutReportItem } from '../../../core/models/login-logout-report.model';
import { ReportingService } from '../../../core/services/reporting/reporting.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';

@Component({
  selector: 'app-login-logout-report',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    FormLabelDirective,
    FormControlDirective,
    ButtonDirective,
    TableDirective,
    TranslocoPipe
  ],
  templateUrl: './login-logout-report.component.html',
  styleUrl: './login-logout-report.component.scss'
})
export class LoginLogoutReportComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  restaurantId = '';

  startDate = '';
  endDate = '';
  loading = false;
  rows: LoginLogoutReportItem[] = [];

  constructor(
    private readonly auth: AuthService,
    private readonly reporting: ReportingService,
    private readonly toast: AppToastService,
    private readonly misc: MiscellaneousService,
    private readonly transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    const user = this.auth.getUserSnapshot();
    this.restaurantId =
      user?.restaurantId == null || user.restaurantId === ''
        ? ''
        : String(Array.isArray(user.restaurantId) ? user.restaurantId[0] : user.restaurantId);

    const { start, end } = LoginLogoutReportComponent.defaultUtcRangeLocal();
    this.startDate = start;
    this.endDate = end;
    if (this.restaurantId) {
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Last 7 days inclusive, formatted as yyyy-MM-dd (local calendar). */
  private static defaultUtcRangeLocal(): { start: string; end: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return {
      start: LoginLogoutReportComponent.formatLocalDateOnly(start),
      end: LoginLogoutReportComponent.formatLocalDateOnly(end)
    };
  }

  private static formatLocalDateOnly(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  load(): void {
    if (!this.restaurantId) {
      this.toast.error(this.transloco.translate('loginLogoutReport.noRestaurant'), 'Error');
      return;
    }
    if (!this.startDate || !this.endDate) {
      return;
    }
    if (this.startDate > this.endDate) {
      this.toast.error(this.transloco.translate('loginLogoutReport.invalidRange'), 'Error');
      return;
    }

    this.loading = true;
    this.reporting
      .getLoginLogoutReport(this.restaurantId, this.startDate, this.endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.rows = res.items ?? [];
          this.loading = false;
        },
        error: err => {
          this.loading = false;
          this.toast.error(this.misc.getFirstErrorMessage(err) ?? this.transloco.translate('loginLogoutReport.error'), 'Error');
        }
      });
  }

  eventLabel(type: string): string {
    if (type === 'LoginSuccess') {
      return this.transloco.translate('loginLogoutReport.eventLogin');
    }
    if (type === 'Logout') {
      return this.transloco.translate('loginLogoutReport.eventLogout');
    }
    return type;
  }
}
