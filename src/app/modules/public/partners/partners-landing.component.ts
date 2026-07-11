import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { PartnerPortfolioSize } from '@app/core/models/partner-inquiry.model';
import { PartnerInquiryService } from '@app/core/services/partner-inquiry/partner-inquiry.service';
import { SeoService } from '@app/core/services/seo/seo.service';
import type { AppLang } from '@app/core/i18n/transloco.config';

@Component({
  selector: 'app-partners-landing',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe],
  templateUrl: './partners-landing.component.html',
  styleUrl: './partners-landing.component.scss',
})
export class PartnersLandingComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly partnerInquiry = inject(PartnerInquiryService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly portfolioSize = PartnerPortfolioSize;
  readonly portfolioOptions = [
    PartnerPortfolioSize.ZeroToFifty,
    PartnerPortfolioSize.FiftyToTwoHundred,
    PartnerPortfolioSize.OverTwoHundred,
  ] as const;

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    contactEmail: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    cityRegion: ['', [Validators.required, Validators.maxLength(200)]],
    portfolioSize: [PartnerPortfolioSize.ZeroToFifty, Validators.required],
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  submitting = false;
  submitSuccess = false;
  submitError = false;

  ngOnInit(): void {
    this.seo.applyPublicPage('partners');
  }

  ngOnDestroy(): void {
    this.seo.clearPublicPage();
  }

  portfolioLabelKey(size: PartnerPortfolioSize): string {
    switch (size) {
      case PartnerPortfolioSize.FiftyToTwoHundred:
        return 'partners.form.portfolio.fiftyToTwoHundred';
      case PartnerPortfolioSize.OverTwoHundred:
        return 'partners.form.portfolio.overTwoHundred';
      default:
        return 'partners.form.portfolio.zeroToFifty';
    }
  }

  showError(controlName: 'companyName' | 'contactEmail' | 'cityRegion' | 'portfolioSize' | 'message'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  onSubmit(): void {
    this.submitSuccess = false;
    this.submitError = false;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const locale = this.resolveLocale();
    const value = this.form.getRawValue();

    this.submitting = true;
    this.partnerInquiry
      .submit({
        companyName: value.companyName.trim(),
        contactEmail: value.contactEmail.trim(),
        cityRegion: value.cityRegion.trim(),
        portfolioSize: Number(value.portfolioSize) as PartnerPortfolioSize,
        message: value.message.trim(),
        locale,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.submitting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.submitSuccess = true;
          this.form.reset({
            companyName: '',
            contactEmail: '',
            cityRegion: '',
            portfolioSize: PartnerPortfolioSize.ZeroToFifty,
            message: '',
          });
        },
        error: () => {
          this.submitError = true;
        },
      });
  }

  private resolveLocale(): string {
    const lang = this.transloco.getActiveLang();
    const supported: AppLang[] = ['ro', 'it', 'en', 'fr', 'es', 'de', 'sv'];
    return supported.includes(lang as AppLang) ? lang : 'en';
  }
}
