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

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ContainerComponent,
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
    NgClass
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

  setLanguage(l: AppLang) {
    this.transloco.setActiveLang(l);
    try { localStorage.setItem(LANG_STORAGE_KEY, l); } catch { /* ignore */ }
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



  ngOnInit(): void {
    combineLatest([
      this.subscriptionService.getProducts(),
      this.subscriptionService.getProductsLimits()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([products, limits]) => {
        this.cards = products;
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
