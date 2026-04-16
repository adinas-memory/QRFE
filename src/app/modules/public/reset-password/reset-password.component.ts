import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  RowComponent,
  AlertComponent,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  standalone: true,
  imports: [
    ContainerComponent, ReactiveFormsModule, RouterLink,
    RowComponent, ColComponent, CardComponent, CardBodyComponent,
    FormDirective, InputGroupComponent, InputGroupTextDirective,
    IconDirective, FormControlDirective, ButtonDirective,
    AlertComponent, TranslocoPipe,
  ],
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  token = '';
  loading = false;
  success = false;
  errorKey: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
  ) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorKey = 'resetPassword.invalidToken';
    }
  }

  get passwordsMismatch(): boolean {
    return this.form.value.password !== this.form.value.confirmPassword
      && this.form.get('confirmPassword')!.touched;
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading || !this.token || this.passwordsMismatch) return;

    this.loading = true;
    this.errorKey = null;

    this.authService.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
      },
      error: (err) => {
        this.errorKey = err?.error?.error ?? 'resetPassword.error';
        this.loading = false;
      },
    });
  }
}
