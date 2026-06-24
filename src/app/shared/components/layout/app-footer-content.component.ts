import { Component, input } from '@angular/core';
import { ContainerComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { COMPANY_EMAIL, COMPANY_WHATSAPP_URL } from '@app/core/constants/company-contact';

/** Shared copyright, P.IVA, email, WhatsApp, and powered-by row for public and admin footers. */
@Component({
  selector: 'app-footer-content',
  standalone: true,
  imports: [ContainerComponent, TranslocoPipe, IconDirective],
  template: `
    <c-container [fluid]="fluid()" class="app-footer-content w-100">
      <div class="app-footer-grid">
        <div class="app-footer-brand">
          <div class="app-footer-brand-name">{{ 'landing.brand' | transloco }}</div>
          <div class="small app-footer-copyright">
            {{ year() }} — {{ 'footer.copyright' | transloco }}
          </div>
          <div class="small app-footer-piva">{{ 'footer.piva' | transloco }}</div>
        </div>

        <div class="app-footer-contact">
          <div class="app-footer-section-label">{{ 'footer.contact' | transloco }}</div>
          <div class="app-footer-contact-links">
            <a
              class="footer-contact-chip"
              [href]="'mailto:' + companyEmail"
              [attr.aria-label]="'footer.emailAria' | transloco"
            >
              <svg cIcon name="cilEnvelopeClosed" size="sm" aria-hidden="true"></svg>
              <span>{{ companyEmail }}</span>
            </a>
            <a
              class="footer-contact-chip"
              [href]="whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              [attr.aria-label]="'footer.whatsappAria' | transloco"
            >
              <svg cIcon name="cilCommentSquare" size="sm" aria-hidden="true"></svg>
              <span>{{ 'footer.phoneWhatsapp' | transloco }}</span>
            </a>
          </div>
        </div>

        <div class="app-footer-powered">
          <div class="app-footer-section-label">{{ 'footer.poweredBy' | transloco }}</div>
          <div class="app-footer-powered-value">
            @if (poweredByUrl()) {
              <a [href]="poweredByUrl()" target="_blank" rel="noopener noreferrer">{{ poweredByLabel() }}</a>
            } @else {
              <span>{{ poweredByLabel() }}</span>
            }
          </div>
        </div>
      </div>
    </c-container>
  `,
  styles: `
    .app-footer-content {
      width: 100%;
      padding: 1.25rem 0 1.5rem;
    }

    .app-footer-grid {
      display: grid;
      gap: 1.5rem 2rem;
      width: 100%;
    }

    @media (min-width: 768px) {
      .app-footer-grid {
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 0.85fr);
        align-items: start;
      }

      .app-footer-contact {
        text-align: center;
      }

      .app-footer-powered {
        text-align: right;
      }
    }

    .app-footer-brand-name {
      font-weight: 800;
      letter-spacing: 0.05em;
      font-size: 1.125rem;
      margin-bottom: 0.35rem;
    }

    .app-footer-copyright {
      opacity: 0.92;
      line-height: 1.45;
    }

    .app-footer-piva {
      margin-top: 0.5rem;
      opacity: 0.8;
      line-height: 1.45;
    }

    .app-footer-section-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.6;
      margin-bottom: 0.55rem;
      font-weight: 700;
    }

    .app-footer-contact-links {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      align-items: flex-start;
    }

    @media (min-width: 768px) {
      .app-footer-contact-links {
        align-items: center;
      }
    }

    .footer-contact-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: color-mix(in srgb, currentColor 6%, transparent);
      color: inherit;
      text-decoration: none;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.3;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.15s ease;
    }

    .footer-contact-chip:hover {
      background: color-mix(in srgb, currentColor 12%, transparent);
      border-color: color-mix(in srgb, currentColor 32%, transparent);
      text-decoration: none;
      transform: translateY(-1px);
    }

    .app-footer-powered-value {
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.45;
    }

    .app-footer-powered-value a {
      color: inherit;
      text-decoration: none;
    }

    .app-footer-powered-value a:hover {
      text-decoration: underline;
    }

    @media (max-width: 767.98px) {
      .app-footer-grid {
        text-align: center;
      }

      .app-footer-contact-links {
        align-items: center;
        width: 100%;
      }

      .footer-contact-chip {
        justify-content: center;
        width: 100%;
        max-width: 22rem;
      }
    }
  `,
})
export class AppFooterContentComponent {
  readonly year = input.required<number>();
  readonly poweredByLabel = input.required<string>();
  readonly poweredByUrl = input<string | null>(null);
  readonly fluid = input(true);
  readonly whatsappUrl = COMPANY_WHATSAPP_URL;
  readonly companyEmail = COMPANY_EMAIL;
}
