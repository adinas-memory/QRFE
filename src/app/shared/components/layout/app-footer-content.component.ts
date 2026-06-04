import { Component, input } from '@angular/core';
import { ContainerComponent } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { COMPANY_WHATSAPP_URL } from '@app/core/constants/company-contact';

/** Shared copyright, P.IVA, WhatsApp, and powered-by row for public and admin footers. */
@Component({
  selector: 'app-footer-content',
  standalone: true,
  imports: [ContainerComponent, TranslocoPipe],
  template: `
    <c-container [fluid]="fluid()" class="py-3 d-flex flex-column gap-2 app-footer-content">
      <div class="d-flex flex-wrap align-items-center gap-2 small">
        <span>{{ year() }} — {{ 'footer.copyright' | transloco }}</span>
        <div class="ms-md-auto">
          <span>{{ 'footer.poweredBy' | transloco }} </span>
          @if (poweredByUrl()) {
            <a [href]="poweredByUrl()" target="_blank" rel="noopener noreferrer">{{ poweredByLabel() }}</a>
          } @else {
            <span>{{ poweredByLabel() }}</span>
          }
        </div>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2 small app-footer-legal">
        <span>{{ 'footer.piva' | transloco }}</span>
        <a
          class="ms-md-auto footer-whatsapp-link"
          [href]="whatsappUrl"
          target="_blank"
          rel="noopener noreferrer"
          [attr.aria-label]="'footer.whatsappAria' | transloco"
        >
          {{ 'footer.phoneWhatsapp' | transloco }}
        </a>
      </div>
    </c-container>
  `,
  styles: `
    .footer-whatsapp-link {
      color: inherit;
      font-weight: 600;
      text-decoration: none;
    }
    .footer-whatsapp-link:hover {
      text-decoration: underline;
    }
    .app-footer-legal {
      opacity: 0.9;
    }
  `,
})
export class AppFooterContentComponent {
  readonly year = input.required<number>();
  readonly poweredByLabel = input.required<string>();
  readonly poweredByUrl = input<string | null>(null);
  readonly fluid = input(true);
  readonly whatsappUrl = COMPANY_WHATSAPP_URL;
}
