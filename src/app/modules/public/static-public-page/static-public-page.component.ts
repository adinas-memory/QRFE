import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ContainerComponent } from '@coreui/angular';
import { PublicUrsShellComponent } from '../public-urs-shell/public-urs-shell.component';
import { SeoService, type PublicSeoPage } from '../../../core/services/seo/seo.service';
import {
  COMPANY_EMAIL,
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL_URL,
  COMPANY_WHATSAPP_URL,
} from '../../../core/constants/company-contact';

type StaticPageId = 'contact' | 'privacy' | 'terms';

interface StaticPageConfig {
  seoPage: PublicSeoPage;
  titleKey: string;
  introKey: string;
  paragraphKeys: string[];
  showContactCards?: boolean;
}

const STATIC_PAGES: Record<StaticPageId, StaticPageConfig> = {
  contact: {
    seoPage: 'contact',
    titleKey: 'legal.contact.pageTitle',
    introKey: 'legal.contact.intro',
    paragraphKeys: ['legal.contact.p1', 'legal.contact.p2'],
    showContactCards: true,
  },
  privacy: {
    seoPage: 'privacy',
    titleKey: 'legal.privacy.pageTitle',
    introKey: 'legal.privacy.intro',
    paragraphKeys: [
      'legal.privacy.p1',
      'legal.privacy.p2',
      'legal.privacy.p3',
      'legal.privacy.p4',
      'legal.privacy.p5',
    ],
  },
  terms: {
    seoPage: 'terms',
    titleKey: 'legal.terms.pageTitle',
    introKey: 'legal.terms.intro',
    paragraphKeys: [
      'legal.terms.p1',
      'legal.terms.p2',
      'legal.terms.p3',
      'legal.terms.p4',
      'legal.terms.p5',
    ],
  },
};

@Component({
  selector: 'app-static-public-page',
  standalone: true,
  imports: [PublicUrsShellComponent, ContainerComponent, TranslocoPipe],
  templateUrl: './static-public-page.component.html',
  styleUrl: './static-public-page.component.scss',
})
export class StaticPublicPageComponent implements OnInit, OnDestroy {
  config: StaticPageConfig | null = null;

  readonly companyEmail = COMPANY_EMAIL;
  readonly phoneDisplay = COMPANY_PHONE_DISPLAY;
  readonly phoneTelUrl = COMPANY_PHONE_TEL_URL;
  readonly whatsappUrl = COMPANY_WHATSAPP_URL;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly seo: SeoService,
  ) {}

  ngOnInit(): void {
    const pageId = this.route.snapshot.data['pageId'] as StaticPageId;
    this.config = STATIC_PAGES[pageId] ?? null;
    if (this.config) {
      this.seo.applyPublicPage(this.config.seoPage);
    }
  }

  ngOnDestroy(): void {
    this.seo.clearPublicPage();
  }
}
