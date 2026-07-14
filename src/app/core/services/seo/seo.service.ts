import { DestroyRef, inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';
import { type AppLang } from '@app/core/i18n/transloco.config';
import { environment } from '../../../../environments/environment';
import {
  COMPANY_EMAIL,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE_E164,
  COMPANY_WEBSITE,
} from '@app/core/constants/company-contact';

export type PublicSeoPage = 'landing' | 'faq' | 'contact' | 'privacy' | 'terms' | 'partners';

const PAGE_PATHS: Record<PublicSeoPage, string> = {
  landing: '/',
  faq: '/faq',
  contact: '/contact',
  privacy: '/privacy',
  terms: '/terms',
  partners: '/partners',
};

const SEO_TITLE_KEYS: Record<PublicSeoPage, string> = {
  landing: 'seo.landingTitle',
  faq: 'seo.faqTitle',
  contact: 'seo.contactTitle',
  privacy: 'seo.privacyTitle',
  terms: 'seo.termsTitle',
  partners: 'seo.partnersTitle',
};

const SEO_DESCRIPTION_KEYS: Record<PublicSeoPage, string> = {
  landing: 'seo.landingDescription',
  faq: 'seo.faqDescription',
  contact: 'seo.contactDescription',
  privacy: 'seo.privacyDescription',
  terms: 'seo.termsDescription',
  partners: 'seo.partnersDescription',
};

const OG_LOCALE_BY_LANG: Record<AppLang, string> = {
  en: 'en_US',
  ro: 'ro_RO',
  it: 'it_IT',
  fr: 'fr_FR',
  es: 'es_ES',
  de: 'de_DE',
  sv: 'sv_SE',
};

const OG_SITE_NAME = 'Universal Restaurant Systems';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer: Renderer2;

  private activePage: PublicSeoPage | null = null;
  private canonicalLink: HTMLLinkElement | null = null;
  private jsonLdScript: HTMLScriptElement | null = null;

  constructor() {
    const rendererFactory = inject(RendererFactory2);
    this.renderer = rendererFactory.createRenderer(null, null);

    this.transloco.langChanges$
      .pipe(
        switchMap((lang) => this.transloco.load(lang)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.activePage) {
          this.applyNow(this.activePage);
        }
      });
  }

  applyPublicPage(page: PublicSeoPage): void {
    this.activePage = page;
    this.clearNoIndex();
    void this.applyWhenTranslationsReady(page);
  }

  applyNoIndex(): void {
    this.activePage = null;
    this.removeCanonical();
    this.removeJsonLd();
    this.upsertMeta('name', 'robots', 'noindex, nofollow');
  }

  clearPublicPage(): void {
    this.activePage = null;
    this.removeCanonical();
    this.removeJsonLd();
  }

  getOgImageUrl(): string {
    return `${this.publicSiteBase()}/public/icons/icon-512x512.png`;
  }

  private applyWhenTranslationsReady(page: PublicSeoPage): void {
    const lang = this.transloco.getActiveLang();
    this.transloco.load(lang).subscribe(() => {
      if (this.activePage === page) {
        this.applyNow(page);
      }
    });
  }

  private applyNow(page: PublicSeoPage): void {
    const pageTitle = this.transloco.translate(SEO_TITLE_KEYS[page]);
    const description = this.transloco.translate(SEO_DESCRIPTION_KEYS[page]);
    const keywords = this.transloco.translate('seo.keywords');
    const lang = this.transloco.getActiveLang() as AppLang;
    const ogLocale = OG_LOCALE_BY_LANG[lang] ?? lang;
    const canonicalUrl = this.buildCanonicalUrl(PAGE_PATHS[page]);
    const ogImage = this.getOgImageUrl();

    this.title.setTitle(pageTitle);
    document.documentElement.lang = lang;

    this.upsertMeta('name', 'description', description);
    this.upsertMeta('name', 'keywords', keywords);
    this.upsertMeta('property', 'og:title', pageTitle);
    this.upsertMeta('property', 'og:description', description);
    this.upsertMeta('property', 'og:locale', ogLocale);
    this.upsertMeta('property', 'og:url', canonicalUrl);
    this.upsertMeta('property', 'og:type', 'website');
    this.upsertMeta('property', 'og:image', ogImage);
    this.upsertMeta('property', 'og:site_name', OG_SITE_NAME);
    this.upsertMeta('name', 'twitter:card', 'summary_large_image');
    this.upsertMeta('name', 'twitter:title', pageTitle);
    this.upsertMeta('name', 'twitter:description', description);
    this.upsertMeta('name', 'twitter:image', ogImage);

    this.setCanonical(canonicalUrl);
    this.setOrganizationJsonLd();
  }

  private publicSiteBase(): string {
    return (environment.publicSiteUrl ?? '').replace(/\/$/, '')
      || (typeof window !== 'undefined' ? window.location.origin : COMPANY_WEBSITE);
  }

  private buildCanonicalUrl(path: string): string {
    const base = this.publicSiteBase();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath === '/' ? '' : normalizedPath}` || base;
  }

  private clearNoIndex(): void {
    const tag = this.meta.getTag("name='robots'");
    if (tag?.content === 'noindex, nofollow') {
      this.meta.removeTag("name='robots'");
    }
  }

  private setCanonical(url: string): void {
    if (!this.canonicalLink) {
      this.canonicalLink = this.renderer.createElement('link') as HTMLLinkElement;
      this.renderer.setAttribute(this.canonicalLink, 'rel', 'canonical');
      this.renderer.appendChild(document.head, this.canonicalLink);
    }
    this.renderer.setAttribute(this.canonicalLink, 'href', url);
  }

  private removeCanonical(): void {
    if (this.canonicalLink?.parentNode) {
      this.renderer.removeChild(document.head, this.canonicalLink);
    }
    this.canonicalLink = null;
  }

  private setOrganizationJsonLd(): void {
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: COMPANY_LEGAL_NAME,
      url: COMPANY_WEBSITE,
      email: COMPANY_EMAIL,
      telephone: COMPANY_PHONE_E164,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Genoa',
        addressCountry: 'IT',
      },
    };

    if (!this.jsonLdScript) {
      this.jsonLdScript = this.renderer.createElement('script') as HTMLScriptElement;
      this.renderer.setAttribute(this.jsonLdScript, 'type', 'application/ld+json');
      this.renderer.appendChild(document.head, this.jsonLdScript);
    }
    this.jsonLdScript.textContent = JSON.stringify(payload);
  }

  private removeJsonLd(): void {
    if (this.jsonLdScript?.parentNode) {
      this.renderer.removeChild(document.head, this.jsonLdScript);
    }
    this.jsonLdScript = null;
  }

  private upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
    const selector = attr === 'name' ? `name='${key}'` : `property='${key}'`;
    const tag = this.meta.getTag(selector);
    if (tag) {
      this.meta.updateTag({ [attr]: key, content });
      return;
    }
    this.meta.addTag({ [attr]: key, content });
  }
}
