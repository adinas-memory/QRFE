import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  ColComponent,
  ContainerComponent,
  RowComponent,
  AlertComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../../core/auth/auth.service';
import { SeoService } from '../../../core/services/seo/seo.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
  standalone: true,
  imports: [
    ContainerComponent, RouterLink,
    RowComponent, ColComponent, CardComponent, CardBodyComponent,
    IconDirective, ButtonDirective,
    AlertComponent, SpinnerComponent, TranslocoPipe,
  ],
})
export class VerifyEmailComponent implements OnInit {
  loading = true;
  success = false;
  errorKey: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private seo: SeoService,
  ) {}

  ngOnInit(): void {
    this.seo.applyNoIndex();
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!token) {
      this.errorKey = 'verifyEmail.invalidToken';
      this.loading = false;
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
      },
      error: (err) => {
        this.errorKey = err?.error?.error ?? 'verifyEmail.error';
        this.loading = false;
      },
    });
  }
}
