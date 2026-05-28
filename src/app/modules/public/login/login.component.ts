import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { NgStyle } from '@angular/common';
import { IconDirective } from '@coreui/icons-angular';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { navigateToRoleHome } from '../../../core/auth/auth-redirect.util';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { UserContextModel } from '../../../core/models/userContextModel';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  standalone: true,
  imports: [RouterLink, ContainerComponent, RowComponent, ColComponent,
    CardGroupComponent, CardComponent, CardBodyComponent, FormDirective,
    InputGroupComponent, InputGroupTextDirective, IconDirective,
    FormControlDirective, ButtonDirective, NgStyle, ReactiveFormsModule,
    TranslocoPipe]
})
export class LoginComponent implements OnInit, OnDestroy {

  loginForm: FormGroup;

  constructor(private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private toast: AppToastService,
    private misc: MiscellaneousService,
    private transloco: TranslocoService) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }


  onSubmit() {
    if (this.loginForm.valid) {
      const formValue = this.loginForm.value;


      this.authService.loginUser(formValue).subscribe({
        next: (response: UserContextModel) => {
          this.authService.setUser(response);
          this.authService.setRestaurantCtx();
          const returnUrl = this.route.snapshot.queryParams['returnUrl'];
          void navigateToRoleHome(this.router, this.subscriptionService, response.role, returnUrl);
        },
        error: (error: unknown) => {
          console.error('Login failed:', error);
          this.toast.error(this.misc.getFirstErrorMessage(error), this.transloco.translate('common.loginFailed'));
        }
      });

    }
  }

  async ngOnInit(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const returnUrl = this.route.snapshot.queryParams['returnUrl'];

    if (this.authService.isAuthenticated()) {
      await navigateToRoleHome(this.router, this.subscriptionService, this.authService.getUserRole(), returnUrl);
      return;
    }

    const user = await firstValueFrom(this.authService.refreshUserContext({ redirectOnFailure: false }));
    if (user) {
      await navigateToRoleHome(this.router, this.subscriptionService, user.role, returnUrl);
    }
  }

  ngOnDestroy(): void {
    // lean up subscriptions or resources if needed
  }

}
