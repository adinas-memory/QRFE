import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { emailFieldValidators } from '../../../core/validators/email.validator';
import { IconDirective } from '@coreui/icons-angular';
import { IconSetService } from '@coreui/icons-angular';
import { cilMobile, cilLockLocked, cilUser } from '@coreui/icons';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { PendingPlanModel } from '../../../core/models/pendingPlanModel';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  standalone: true,
  imports: [ContainerComponent, ReactiveFormsModule,
    RowComponent, ColComponent, CardComponent, CardBodyComponent,
    FormDirective, InputGroupComponent, InputGroupTextDirective,
    IconDirective, FormControlDirective, ButtonDirective,
    RouterLink, TranslocoPipe]
})
export class RegisterComponent implements OnInit {
  public icons = { cilMobile };
  registerForm: FormGroup;
  pendingSubscriptionPlan: PendingPlanModel | null = null;


  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private toast: AppToastService,
    private misc: MiscellaneousService,
    private transloco: TranslocoService,
    public iconSet: IconSetService
  ) {
    this.iconSet.icons = { cilMobile, cilLockLocked, cilUser };
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: [''],
      email: ['', emailFieldValidators],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const formValue = this.registerForm.value;

    this.authService.registerUser(formValue).subscribe({
        next: (response: UserContextModel) => {
          this.authService.setUser(response);

          const pendingNow = this.subscriptionService.getPendingPlan();
          if (pendingNow) {
            void this.router.navigateByUrl('/public/restaurant-setup');
          } else {
            this.router.navigate(['/']);
          }

        },
        error: (error: unknown) => {
          console.error('Registration failed', error);
          this.toast.error(this.misc.getFirstErrorMessage(error), this.transloco.translate('common.registrationFailed'));
        }
      });
  }

  ngOnInit(): void {
    this.pendingSubscriptionPlan = this.subscriptionService.getPendingPlan();
  }


}
