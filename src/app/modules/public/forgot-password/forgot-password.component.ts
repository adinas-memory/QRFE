import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { emailFieldValidators } from '../../../core/validators/email.validator';
import { RouterLink } from '@angular/router';
import { IconDirective } from '@coreui/icons-angular';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { SeoService } from '../../../core/services/seo/seo.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  standalone: true,
  imports: [
    ContainerComponent, ReactiveFormsModule, RouterLink,
    RowComponent, ColComponent, CardComponent, CardBodyComponent,
    FormDirective, InputGroupComponent, InputGroupTextDirective,
    IconDirective, FormControlDirective, ButtonDirective,
    AlertComponent, TranslocoPipe,
  ],
})
export class ForgotPasswordComponent implements OnInit {
  form: FormGroup;
  submitted = false;
  loading = false;
  errorKey: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private seo: SeoService,
  ) {
    this.form = this.fb.group({
      email: ['', emailFieldValidators],
    });
  }

  ngOnInit(): void {
    this.seo.applyNoIndex();
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorKey = null;

    const { email } = this.form.value;
    this.authService.forgotPassword(email).subscribe({
      next: () => {
        this.submitted = true;
        this.loading = false;
      },
      error: () => {
        this.errorKey = 'forgotPassword.error';
        this.loading = false;
      },
    });
  }
}
