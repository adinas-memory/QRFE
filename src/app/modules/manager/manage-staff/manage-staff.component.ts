import { Component, OnDestroy, OnInit } from '@angular/core';
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
  RowComponent,
  TableDirective,
  ToasterComponent,
  ToasterPlacement
} from '@coreui/angular';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { filter, Subject, take, takeUntil, tap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { RestaurantStaffListItem } from '../../../core/models/restaurant-staff-list-item.model';
import { StaffAdminService } from '../../../core/services/staff-admin-service/staff-admin.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { emailFieldValidators } from '../../../core/validators/email.validator';

/** Aligned with backend `RegisterRequestModel` password rules. */
const STAFF_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const DISABLED_STAFF_ROLE = 'soft_deleted_staff_user';

@Component({
  selector: 'app-manage-staff',
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
    ButtonDirective,
    TableDirective,
    ReactiveFormsModule,
    TranslocoPipe,
    ToasterComponent
  ],
  templateUrl: './manage-staff.component.html',
  styleUrl: './manage-staff.component.scss'
})
export class ManageStaffComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private restaurantId = '';

  staffForm: FormGroup;
  submitting = false;
  staffList: RestaurantStaffListItem[] = [];
  listLoading = false;
  actionEmployeeId: string | null = null;
  readonly placement = ToasterPlacement.TopEnd;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly staffAdmin: StaffAdminService,
    private readonly appToast: AppToastService,
    private readonly transloco: TranslocoService
  ) {
    this.staffForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.maxLength(150)]],
        surname: ['', [Validators.required, Validators.maxLength(150)]],
        email: ['', [...emailFieldValidators, Validators.maxLength(200)]],
        phone: ['', [Validators.maxLength(50)]],
        password: ['', [Validators.required, Validators.pattern(STAFF_PASSWORD_PATTERN)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: [ManageStaffComponent.matchPasswords] }
    );
  }

  private static matchPasswords(group: AbstractControl): ValidationErrors | null {
    const g = group as FormGroup;
    const p = g.get('password')?.value as string | undefined;
    const c = g.get('confirmPassword')?.value as string | undefined;
    if (p === undefined || c === undefined) return null;
    return p === c ? null : { mismatch: true };
  }

  isStaffDisabled(item: RestaurantStaffListItem): boolean {
    return item.role.toLowerCase() === DISABLED_STAFF_ROLE;
  }

  isManagerAccount(item: RestaurantStaffListItem): boolean {
    return item.role.toLowerCase() === 'manager';
  }

  canToggleAccess(item: RestaurantStaffListItem): boolean {
    const role = item.role.toLowerCase();
    return role === 'staff' || role === DISABLED_STAFF_ROLE;
  }

  statusLabelKey(item: RestaurantStaffListItem): string {
    if (this.isManagerAccount(item)) {
      return 'manageStaff.statusManager';
    }
    if (this.isStaffDisabled(item)) {
      return 'manageStaff.statusDisabled';
    }
    return 'manageStaff.statusActive';
  }

  loadStaffList(): void {
    if (!this.restaurantId) {
      return;
    }

    this.listLoading = true;
    this.staffAdmin
      .listStaff(this.restaurantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: staff => {
          this.staffList = staff ?? [];
          this.listLoading = false;
        },
        error: () => {
          this.listLoading = false;
          this.appToast.error(this.transloco.translate('manageStaff.listLoadError'));
        }
      });
  }

  onDisableStaff(item: RestaurantStaffListItem): void {
    if (!this.restaurantId || this.actionEmployeeId) {
      return;
    }

    this.actionEmployeeId = item.userId;
    this.staffAdmin
      .disableStaff(this.restaurantId, item.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionEmployeeId = null;
          this.appToast.success(
            this.transloco.translate('manageStaff.disableSuccessBody'),
            this.transloco.translate('manageStaff.disableSuccessTitle')
          );
          this.loadStaffList();
        },
        error: () => {
          this.actionEmployeeId = null;
          this.appToast.error(this.transloco.translate('manageStaff.disableError'));
        }
      });
  }

  onEnableStaff(item: RestaurantStaffListItem): void {
    if (!this.restaurantId || this.actionEmployeeId) {
      return;
    }

    this.actionEmployeeId = item.userId;
    this.staffAdmin
      .enableStaff(this.restaurantId, item.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionEmployeeId = null;
          this.appToast.success(
            this.transloco.translate('manageStaff.enableSuccessBody'),
            this.transloco.translate('manageStaff.enableSuccessTitle')
          );
          this.loadStaffList();
        },
        error: () => {
          this.actionEmployeeId = null;
          this.appToast.error(this.transloco.translate('manageStaff.enableError'));
        }
      });
  }

  onSubmit(): void {
    if (this.staffForm.invalid || !this.restaurantId) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const v = this.staffForm.value as {
      name: string;
      surname: string;
      email: string;
      phone: string;
      password: string;
      confirmPassword: string;
    };

    this.staffAdmin
      .registerStaff(this.restaurantId, {
        name: v.name.trim(),
        surname: v.surname.trim(),
        email: v.email.trim(),
        phone: (v.phone ?? '').trim(),
        password: v.password,
        confirmPassword: v.confirmPassword
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.submitting = false;
          if (res.isSuccess) {
            this.appToast.success(
              this.transloco.translate('manageStaff.successBody'),
              this.transloco.translate('manageStaff.successTitle')
            );
            this.staffForm.reset();
            this.loadStaffList();
          } else {
            this.appToast.error(this.transloco.translate('manageStaff.errorGeneric'));
          }
        },
        error: () => {
          this.submitting = false;
          this.appToast.error(this.transloco.translate('manageStaff.errorGeneric'));
        }
      });
  }

  ngOnInit(): void {
    this.authService
      .getUserContext()
      .pipe(
        takeUntil(this.destroy$),
        filter((user): user is UserContextModel => !!user?.restaurantId),
        take(1),
        tap(user => {
          this.restaurantId = user.restaurantId ?? '';
          this.loadStaffList();
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
