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
  ToasterComponent,
  ToasterPlacement
} from '@coreui/angular';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { emailFieldValidators } from '../../../core/validators/email.validator';

const RESELLER_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

@Component({
  selector: 'app-manage-resellers',
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
    ReactiveFormsModule,
    TranslocoPipe,
    ToasterComponent
  ],
  templateUrl: './manage-resellers.component.html'
})
export class ManageResellersComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  resellerForm: FormGroup;
  submitting = false;
  readonly placement = ToasterPlacement.TopEnd;

  constructor(
    private readonly fb: FormBuilder,
    private readonly globalAdmin: GlobalAdminService,
    private readonly appToast: AppToastService,
    private readonly transloco: TranslocoService
  ) {
    this.resellerForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.maxLength(150)]],
        surname: ['', [Validators.required, Validators.maxLength(150)]],
        email: ['', [...emailFieldValidators, Validators.maxLength(200)]],
        phone: ['', [Validators.maxLength(50)]],
        password: ['', [Validators.required, Validators.pattern(RESELLER_PASSWORD_PATTERN)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: [ManageResellersComponent.matchPasswords] }
    );
  }

  private static matchPasswords(group: AbstractControl): ValidationErrors | null {
    const g = group as FormGroup;
    const p = g.get('password')?.value as string | undefined;
    const c = g.get('confirmPassword')?.value as string | undefined;
    if (p === undefined || c === undefined) return null;
    return p === c ? null : { mismatch: true };
  }

  ngOnInit(): void {
    /* no-op */
  }

  onSubmit(): void {
    if (this.resellerForm.invalid) {
      this.resellerForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const v = this.resellerForm.value as {
      name: string;
      surname: string;
      email: string;
      phone: string;
      password: string;
    };

    this.globalAdmin
      .createReseller({
        name: v.name.trim(),
        surname: v.surname.trim(),
        email: v.email.trim(),
        phone: (v.phone ?? '').trim(),
        password: v.password
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.submitting = false;
          if (res.isSuccess) {
            this.appToast.success(
              this.transloco.translate('manageResellers.successBody'),
              this.transloco.translate('manageResellers.successTitle')
            );
            this.resellerForm.reset();
          } else {
            this.appToast.error(this.transloco.translate('manageResellers.errorGeneric'));
          }
        },
        error: () => {
          this.submitting = false;
          this.appToast.error(this.transloco.translate('manageResellers.errorGeneric'));
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
