import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';

export type PublicSeoPage = 'landing' | 'faq';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private activePage: PublicSeoPage | null = null;

  constructor() {
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.activePage) {
          this.applyNow(this.activePage);
        }
      });
  }

  applyPublicPage(page: PublicSeoPage): void {
    this.activePage = page;
    this.applyNow(page);
  }

  clearPublicPage(): void {
    this.activePage = null;
  }

  private applyNow(page: PublicSeoPage): void {
    const titleKey = page === 'landing' ? 'seo.landingTitle' : 'seo.faqTitle';
    const descriptionKey = page === 'landing' ? 'seo.landingDescription' : 'seo.faqDescription';
    const pageTitle = this.transloco.translate(titleKey);
    const description = this.transloco.translate(descriptionKey);
    const keywords = this.transloco.translate('seo.keywords');
    const lang = this.transloco.getActiveLang();

    this.title.setTitle(pageTitle);
    document.documentElement.lang = lang;

    this.upsertMeta('name', 'description', description);
    this.upsertMeta('name', 'keywords', keywords);
    this.upsertMeta('property', 'og:title', pageTitle);
    this.upsertMeta('property', 'og:description', description);
    this.upsertMeta('property', 'og:locale', lang);
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
