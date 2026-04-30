import { UserContextModel } from './../../../core/models/userContextModel';
import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ContainerComponent,
  HeaderComponent,
  HeaderDividerComponent,
  NavItemComponent,
  HeaderNavComponent,
  HeaderTextComponent,
  NavLinkDirective,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardTextDirective,
  CardTitleDirective,
  ColComponent,
  RowComponent,
  BorderDirective,
  CardFooterComponent,
  CardHeaderComponent,
} from '@coreui/angular';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { ProductLimitModel, RestaurantType, SubscriptionProductModel } from '../../../core/models/subscription-product';
import { combineLatest, forkJoin, Subject, Subscription, takeUntil } from 'rxjs';
import { CurrencyPipe, JsonPipe, NgClass } from '@angular/common';
import { DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective } from '@coreui/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LANG_STORAGE_KEY, type AppLang } from '../../../core/i18n/transloco.config';
import { FaqComponent } from '../faq/faq.component';
import { environment } from '../../../../environments/environment';
import { FooterComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { FeedbackLaunchComponent } from '@app/shared/components/feedback/feedback-launch.component';
import { FeedbackModalComponent } from '@app/shared/components/feedback/feedback-modal.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [FaqComponent, ContainerComponent,
    HeaderComponent, CurrencyPipe, JsonPipe,
    HeaderDividerComponent,
    HeaderTextComponent,
    HeaderNavComponent,
    NavItemComponent,
    NavLinkDirective,
    RouterLink,
    RowComponent,
    ColComponent,
    CardComponent, BorderDirective,
    CardBodyComponent, CardHeaderComponent,
    CardTitleDirective, CardFooterComponent,
    CardTextDirective,
    ButtonDirective,
    DropdownComponent,
    DropdownItemDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    TranslocoPipe,
    NgClass,
    FooterComponent,
    IconDirective,
    FeedbackLaunchComponent,
    FeedbackModalComponent,
  ],
  styleUrls: ['./landing.component.scss'],
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  public cards: SubscriptionProductModel[] = [];
  private userSubscription: Subscription | any;
  private user: UserContextModel | any;
  private role: string | null = null;
  productLimits: ProductLimitModel[] | null = null;
  private destroy$ = new Subject<void>();
  cardBorderColor: string = 'light';
  cardBackgroundColor: string = '#2b81d6ff';

  theme: 'dark' | 'light' = 'dark';
  readonly year = new Date().getFullYear();
  readonly poweredBy = environment.poweredBy;
  readonly frontendPublicUrl = environment.apiUrl;

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private transloco: TranslocoService,
    private router: Router) {

  }

  get activeLang(): AppLang {
    const l = this.transloco.getActiveLang();
    return (l === 'ro' || l === 'en' || l === 'it' || l === 'fr' || l === 'es' || l === 'de' || l === 'sv') ? l : 'ro';
  }

  /** CoreUI Icons flag sprites: locale `en` uses `cif-gb`, not `cif-en`. */
  private readonly langFlagClass: Record<AppLang, string> = {
    ro: 'cif-ro',
    en: 'cif-gb',
    it: 'cif-it',
    fr: 'cif-fr',
    es: 'cif-es',
    de: 'cif-de',
    sv: 'cif-se',
  };

  get activeLangFlagClass(): string {
    return this.langFlagClass[this.activeLang];
  }

  /** Outline buttons: light-on-dark in dark theme, dark-on-light in light theme (CoreUI `color`). */
  get outlineBtnColor(): 'light' | 'dark' {
    return this.theme === 'light' ? 'dark' : 'light';
  }

  setLanguage(l: AppLang) {
    this.transloco.setActiveLang(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* ignore */ }
  }

  setTheme(t: 'dark' | 'light'): void {
    this.theme = t;
    try {
      localStorage.setItem('publicTheme', t);
    } catch { /* ignore */ }
  }

  handleCardClick(card: SubscriptionProductModel): void {
    this.subscriptionService.setPendingPlan({
      priceId: card.priceId,
      restaurantType: card.restaurantType
    });

    const userRole = this.authService.getUserRole();
    const isAuthed = this.authService.isAuthenticated();

    // If we don't have a reliable role yet, treat as not authenticated
    if (!isAuthed || !userRole) {
      this.router.navigate(['/register']);
      return;
    }

    if (userRole === 'default') {
      void this.router.navigateByUrl('/public/restaurant-setup');
      return;
    }

    // fallback: user is authenticated but not a subscribable role
    if (userRole === 'staff') {
      this.router.navigate(['/staff']);
      return;
    }
    if (userRole === 'manager') {
      this.router.navigate(['/manager']);
      return;
    }
    if (userRole === 'gadmin') {
      this.router.navigate(['/gadmin']);
      return;
    }

    this.router.navigate(['/login']);
  }

  getLimit(type: string) {
    return this.productLimits?.find(l => l.type === type);
  }

  getFeatureKeys(card: SubscriptionProductModel): string[] {
    const raw = (card?.features ?? '').trim();
    if (!raw) {
      return this.defaultFeatureKeys();
    }

    // Preferred format: JSON array of Transloco keys.
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
        return parsed as string[];
      }
    } catch {
      // fallthrough
    }

    // Back-compat: allow newline/comma separated text -> show as plain labels (no transloco).
    const parts = raw.split(/\r?\n|,/g).map(x => x.trim()).filter(Boolean);
    return parts.length ? parts.map(x => `pricing.features._plain:${x}`) : this.defaultFeatureKeys();
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
      'pricing.features.sseTablesLive'
    ];
  }

  featureLabel(key: string): string {
    // If key is in the pseudo-namespace, return the plain text after ':'
    if (key.startsWith('pricing.features._plain:')) return key.split(':', 2)[1] ?? '';
    return this.transloco.translate(key);
  }



  ngOnInit(): void {
    this.theme = (localStorage.getItem('publicTheme') as 'dark' | 'light') || 'dark';

    combineLatest([
      this.subscriptionService.getProducts(),
      this.subscriptionService.getProductsLimits()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([products, limits]) => {
        const order: Record<string, number> = { small: 0, medium: 1, large: 2 };
        this.cards = [...products].sort((a, b) => {
          const av = order[(a.restaurantType ?? '').toLowerCase()] ?? 99;
          const bv = order[(b.restaurantType ?? '').toLowerCase()] ?? 99;
          return av - bv;
        });
        this.productLimits = limits;
      });
  }

  ngAfterViewInit(): void {
    this.authService.clearRestaurantCtx();
    // this.authService.clearUser();
    
  }



  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
