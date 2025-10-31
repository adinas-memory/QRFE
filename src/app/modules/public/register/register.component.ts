import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
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
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { UserContextModel } from '../../../core/models/userContextModel';
import { PendingPlanModel } from '../../../core/models/pendingPlanModel';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  standalone: true,
  imports: [ContainerComponent, ReactiveFormsModule,
    RowComponent, ColComponent, CardComponent, CardBodyComponent,
    FormDirective, InputGroupComponent, InputGroupTextDirective,
    IconDirective, FormControlDirective, ButtonDirective]
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
    public iconSet: IconSetService
  ) {
    this.iconSet.icons = { cilMobile, cilLockLocked, cilUser };
    this.registerForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      confirmPassword: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      const formValue = this.registerForm.value;

      this.authService.registerUser(formValue).subscribe({
        next: (response: UserContextModel) => {
          this.authService.setUser(response);

          if (this.pendingSubscriptionPlan) {
            this.router.navigate(['/restaurant-setup']);
          } else {
            this.router.navigate(['/']);
          }

        },
        error: (error) => {
          console.error('Registration failed', error);
          this.subscriptionService.clearPendingPlan();
        }
      });
    }
  }

  ngOnInit(): void {
    this.pendingSubscriptionPlan = this.subscriptionService.getPendingPlan();
  }


}
