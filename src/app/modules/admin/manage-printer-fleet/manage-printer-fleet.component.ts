import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ButtonDirective, TableDirective } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { interval, Subject, startWith, switchMap, takeUntil } from 'rxjs';
import { GlobalAdminPrinterFleetItem } from '../../../core/models/global-admin-printer-fleet.model';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';

@Component({
  selector: 'app-manage-printer-fleet',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DatePipe, TableDirective, ButtonDirective, TranslocoPipe],
  templateUrl: './manage-printer-fleet.component.html',
})
export class ManagePrinterFleetComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly refreshMs = 30_000;

  rows: GlobalAdminPrinterFleetItem[] = [];
  loading = true;
  errorMessage: string | null = null;
  lastLoadedAt: Date | null = null;

  constructor(private globalAdmin: GlobalAdminService) {}

  ngOnInit(): void {
    interval(this.refreshMs)
      .pipe(
        startWith(0),
        switchMap(() => this.globalAdmin.listPrinterFleet()),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: rows => {
          this.rows = rows ?? [];
          this.loading = false;
          this.errorMessage = null;
          this.lastLoadedAt = new Date();
        },
        error: err => {
          console.error('Failed to load printer fleet', err);
          this.loading = false;
          this.errorMessage = 'loadFailed';
        },
      });
  }

  refresh(): void {
    this.loading = true;
    this.globalAdmin.listPrinterFleet()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: rows => {
          this.rows = rows ?? [];
          this.loading = false;
          this.errorMessage = null;
          this.lastLoadedAt = new Date();
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'loadFailed';
        },
      });
  }

  printerStatusClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'online') return 'text-success';
    if (normalized === 'offline') return 'text-danger';
    return 'text-body-secondary';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
