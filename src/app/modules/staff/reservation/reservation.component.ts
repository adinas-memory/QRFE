import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
} from '@coreui/angular';
import { DatePipe } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ReservationItem,
  ReservationService,
  ReservationTableOption,
} from '../../../core/services/reservation-service/reservation.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

/** RFC3339 cu offsetul fusului orar local al browserului. */
function toRfc3339WithOffset(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
}

@Component({
  selector: 'app-reservation',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TranslocoPipe,
    ContainerComponent,
    RowComponent,
    ColComponent,
    CardComponent,
    CardHeaderComponent,
    CardBodyComponent,
    FormLabelDirective,
    FormControlDirective,
    ButtonDirective,
  ],
  templateUrl: './reservation.component.html',
  styleUrl: './reservation.component.scss',
})
export class ReservationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reservations = inject(ReservationService);

  restaurantId: string | null = null;
  reservationsList: ReservationItem[] = [];
  tableOptions: ReservationTableOption[] = [];
  loadingList = false;
  loadingTables = false;

  selectedReservationId: string | null = null;
  editing = false;

  readonly form = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    phone: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(32)]],
    partySize: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    tableId: ['', Validators.required],
    startLocal: ['', Validators.required],
  });

  submitting = false;
  bookingSuccess = false;
  error: string | null = null;
  lastEventId: string | null = null;

  ngOnInit(): void {
    this.restaurantId = this.resolveRestaurantId();
    this.auth.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.restaurantId = this.resolveRestaurantId();
        this.loadTables();
        this.refreshList();
      });

    this.loadTables();
    this.refreshList();
  }

  private resolveRestaurantId(): string | null {
    const id = this.auth.getUserRestaurantId();
    if (id == null) return null;
    if (Array.isArray(id)) return id[0] ?? null;
    return id;
  }

  loadTables(): void {
    const rid = this.resolveRestaurantId();
    if (!rid) {
      this.tableOptions = [];
      return;
    }
    this.loadingTables = true;
    this.reservations.listTablesForReservations(rid).subscribe({
      next: (opts) => {
        this.loadingTables = false;
        this.tableOptions = opts;
        this.applyDefaultTableSelection();
      },
      error: () => {
        this.loadingTables = false;
        this.tableOptions = [];
      },
    });
  }

  /** When not editing, pre-select the first table so the form is valid and matches backend expectations. */
  private applyDefaultTableSelection(): void {
    if (this.editing) return;
    const current = this.form.controls.tableId.getRawValue();
    if (current && this.tableOptions.some((t) => t.tableId === current)) return;
    const first = this.tableOptions[0]?.tableId;
    this.form.patchValue({ tableId: first ?? '' });
  }

  refreshAll(): void {
    this.loadTables();
    this.refreshList();
  }

  refreshList(): void {
    const rid = this.resolveRestaurantId();
    if (!rid) return;

    this.loadingList = true;
    this.reservations.list(rid, { take: 50, includeCancelled: false }).subscribe({
      next: (items) => {
        this.loadingList = false;
        this.reservationsList = items;
      },
      error: () => {
        this.loadingList = false;
      },
    });
  }

  selectForEdit(item: ReservationItem): void {
    this.editing = true;
    this.selectedReservationId = item.reservationId;
    this.bookingSuccess = false;
    this.error = null;
    this.errorKey = null;
    this.lastEventId = null;

    // Backend returnează RFC3339; convertim pentru datetime-local.
    const dt = new Date(item.start);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const startLocal = Number.isNaN(dt.getTime())
      ? ''
      : `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

    this.form.setValue({
      customerName: item.customerName,
      phone: item.phone,
      partySize: item.partySize,
      tableId: item.tableId,
      startLocal,
    });
  }

  cancelEdit(): void {
    this.editing = false;
    this.selectedReservationId = null;
    this.form.reset({ customerName: '', phone: '', partySize: 2, tableId: '', startLocal: '' });
    this.applyDefaultTableSelection();
  }

  submit(): void {
    this.bookingSuccess = false;
    this.error = null;
    this.lastEventId = null;

    const rid = this.resolveRestaurantId();
    if (!rid) {
      this.errorKey = 'missingRestaurant';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const local = new Date(raw.startLocal);
    if (Number.isNaN(local.getTime())) {
      this.errorKey = 'invalidDate';
      return;
    }

    const start = toRfc3339WithOffset(local);

    this.submitting = true;
    this.errorKey = null;
    const payload = {
      customerName: raw.customerName.trim(),
      phone: raw.phone.trim(),
      partySize: raw.partySize,
      tableId: raw.tableId,
      start,
    };

    const request$: Observable<unknown> = this.editing && this.selectedReservationId
      ? this.reservations.update(rid, this.selectedReservationId, payload)
      : this.reservations.create(rid, payload);

    request$.subscribe({
      next: (res: unknown) => {
        this.submitting = false;
        if (!this.editing) this.lastEventId = (res as any)?.eventId ?? null;
        this.bookingSuccess = true;
        this.refreshList();
        if (this.editing) this.cancelEdit();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting = false;
        const msg = err?.error?.errors?.[0]?.message ?? err?.error?.message ?? err?.message;
        if (typeof msg === 'string' && msg.length > 0) {
          this.error = msg;
          this.errorKey = null;
        } else {
          this.errorKey = 'generic';
        }
      },
    });
  }

  deleteReservation(item: ReservationItem): void {
    const rid = this.resolveRestaurantId();
    if (!rid) return;
    this.reservations.delete(rid, item.reservationId).subscribe({
      next: () => {
        this.refreshList();
        if (this.selectedReservationId === item.reservationId) this.cancelEdit();
      },
      error: () => this.refreshList(),
    });
  }

  /** Cheie transloco pentru erori standard; null = afișăm `error` brut (API). */
  errorKey: 'missingRestaurant' | 'invalidDate' | 'generic' | null = null;
}
