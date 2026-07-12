import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { ProductLimitModel, SubscriptionProductModel } from '../../../core/models/subscription-product';
import { combineLatest, distinctUntilChanged, map, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FaqComponent } from '../faq/faq.component';
import { PublicUrsShellComponent } from '../public-urs-shell/public-urs-shell.component';
import {
  LANDING_PRODUCT_LIMITS_FALLBACK,
  resolveLandingSubscriptionProducts,
} from './landing-subscription-fallback';
import { SeoService } from '../../../core/services/seo/seo.service';
import { marketFromLang } from '../../../core/i18n/subscription-market.config';

interface LandingFeature {
  icon: string;
  titleKey: string;
  descKey: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    FaqComponent,
    CurrencyPipe,
    PublicUrsShellComponent,
    TranslocoPipe,
  ],
  styleUrls: ['./landing.component.scss'],
  templateUrl: './landing.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  cards: SubscriptionProductModel[] = [];
  productLimits: ProductLimitModel[] | null = null;
  activeSection = 'top';

  readonly featureItems: LandingFeature[] = [
    { icon: 'bi-wifi-off', titleKey: 'landing.feat.offline.t', descKey: 'landing.feat.offline.d' },
    { icon: 'bi-phone', titleKey: 'landing.feat.mobile.t', descKey: 'landing.feat.mobile.d' },
    { icon: 'bi-printer', titleKey: 'landing.feat.print.t', descKey: 'landing.feat.print.d' },
    { icon: 'bi-cloud-arrow-up', titleKey: 'landing.feat.cloud.t', descKey: 'landing.feat.cloud.d' },
    { icon: 'bi-graph-up-arrow', titleKey: 'landing.feat.sales.t', descKey: 'landing.feat.sales.d' },
    { icon: 'bi-people', titleKey: 'landing.feat.staff.t', descKey: 'landing.feat.staff.d' },
  ];

  private readonly destroy$ = new Subject<void>();
  private revealObserver: IntersectionObserver | null = null;
  private sectionObserver: IntersectionObserver | null = null;
  private activeMarket = marketFromLang(this.transloco.getActiveLang());

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private transloco: TranslocoService,
    private router: Router,
    private seo: SeoService,
  ) {}

  handleCardClick(card: SubscriptionProductModel): void {
    this.subscriptionService.setPendingPlan({
      priceId: card.priceId,
      restaurantType: card.restaurantType,
    });

    const userRole = this.authService.getUserRole();
    const isAuthed = this.authService.isAuthenticated();

    if (!isAuthed || !userRole) {
      void this.router.navigate(['/register']);
      return;
    }

    if (userRole === 'default') {
      void this.router.navigateByUrl('/public/restaurant-setup');
      return;
    }

    if (userRole === 'staff') {
      void this.router.navigate(['/staff']);
      return;
    }
    if (userRole === 'manager') {
      void this.router.navigate(['/manager']);
      return;
    }
    if (userRole === 'gadmin') {
      void this.router.navigate(['/gadmin']);
      return;
    }

    void this.router.navigate(['/login']);
  }

  getLimit(type: string): ProductLimitModel | undefined {
    const key = (type ?? '').toLowerCase();
    return this.productLimits?.find(l => (l.type ?? '').toLowerCase() === key);
  }

  getFeatureKeys(card: SubscriptionProductModel): string[] {
    const raw = (card?.features ?? '').trim();
    if (!raw) {
      return this.defaultFeatureKeys();
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
        return parsed as string[];
      }
    } catch {
      // fallthrough
    }

    const parts = raw.split(/\r?\n|,/g).map(x => x.trim()).filter(Boolean);
    return parts.length ? parts.map(x => `pricing.features._plain:${x}`) : this.defaultFeatureKeys();
  }

  featureLabel(key: string): string {
    if (key.startsWith('pricing.features._plain:')) return key.split(':', 2)[1] ?? '';
    return this.transloco.translate(key);
  }

  restaurantTypeLabel(type: string | undefined): string {
    const t = (type ?? '').trim();
    if (!t) return '';
    return `${t.charAt(0).toUpperCase()}${t.slice(1).toLowerCase()} restaurant`;
  }

  planTitle(card: SubscriptionProductModel): string {
    const desc = card.description?.trim() ?? '';
    const dash = desc.indexOf(' - ');
    if (dash > 0) {
      return desc.slice(0, dash).trim();
    }
    return this.restaurantTypeLabel(card.restaurantType);
  }

  planSubtitle(card: SubscriptionProductModel): string {
    const desc = card.description?.trim() ?? '';
    const dash = desc.indexOf(' - ');
    if (dash > 0) {
      return desc.slice(dash + 3).trim();
    }
    return '';
  }

  isFeaturedCard(index: number): boolean {
    if (this.cards.length < 2) return false;
    return index === Math.floor((this.cards.length - 1) / 2);
  }

  scrollTo(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.activeSection = sectionId;
    }
  }

  ngOnInit(): void {
    this.seo.applyPublicPage('landing');

    const market$ = this.transloco.langChanges$.pipe(
      startWith(this.transloco.getActiveLang()),
      map(lang => marketFromLang(lang)),
      distinctUntilChanged(),
    );

    combineLatest([
      market$.pipe(
        switchMap(market => {
          if (market !== this.activeMarket) {
            this.subscriptionService.clearPendingPlan();
            this.activeMarket = market;
          }
          return this.subscriptionService.getProducts(market).pipe(
            map(products => ({ market, products })),
          );
        }),
      ),
      this.subscriptionService.getProductsLimits(),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([{ market, products }, limits]) => {
        this.cards = resolveLandingSubscriptionProducts(products, market);
        this.productLimits = limits?.length ? limits : [...LANDING_PRODUCT_LIMITS_FALLBACK];
      });
  }

  ngAfterViewInit(): void {
    this.authService.clearRestaurantCtx();
    this.setupRevealObserver();
    this.setupSectionObserver();
  }

  ngOnDestroy(): void {
    this.seo.clearPublicPage();
    this.revealObserver?.disconnect();
    this.sectionObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private defaultFeatureKeys(): string[] {
    return [
      'pricing.features.cardPayments',
      'pricing.features.qrMenu',
      'pricing.features.callWaiter',
      'pricing.features.reports',
      'pricing.features.bookings',
      'pricing.features.realtimeUpdates',
      'pricing.features.offlineFirst',
      'pricing.features.kitchenBarScreens',
      'pricing.features.paymentLock',
      'pricing.features.menuUnavailable',
      'pricing.features.multilanguageUI',
      'pricing.features.menuDescriptionTranslation',
      'pricing.features.sseTablesLive',
      'pricing.features.ecoBon',
    ];
  }

  private setupRevealObserver(): void {
    const revealEls = document.querySelectorAll('.urs-landing-shell .reveal');
    if (!revealEls.length) return;

    if (!('IntersectionObserver' in window)) {
      revealEls.forEach(el => el.classList.add('in'));
      return;
    }

    this.revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          this.revealObserver?.unobserve(entry.target);
        });
      },
      { threshold: 0.12 },
    );
    revealEls.forEach(el => this.revealObserver?.observe(el));
  }

  private setupSectionObserver(): void {
    const sections = document.querySelectorAll('.urs-landing-shell section[id], .urs-landing-shell header[id]');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    this.sectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute('id');
          if (id) this.activeSection = id;
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach(s => this.sectionObserver?.observe(s));
  }
}
