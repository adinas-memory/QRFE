import { UserContextModel } from './../../../core/models/userContextModel';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { CurrencyPipe, JsonPipe } from '@angular/common';

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
  ],
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit, OnDestroy {
  public cards: SubscriptionProductModel[] = [];
  private userSubscription: Subscription | any;
  private user: UserContextModel | any;
  private role: string | null = null;
  productLimits: ProductLimitModel[] | null = null;
  private destroy$ = new Subject<void>();
  cardBorderColor: string = 'light';


  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router) {

  }


  handleCardClick(card: SubscriptionProductModel): void {
    // set pending plan and redirect to login
    this.subscriptionService.setPendingPlan({
      priceId: card.priceId,
      restaurantType: card.restaurantType
    });
    if (!this.user) {
      this.router.navigate(['/login']);
    }
    else if (this.role === 'default') {
      // implement ping()
      this.router.navigate(['public/restaurant-setup']);
    } else {
      this.router.navigate(['/404']);
    }
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


    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => this.user = user);


    this.role = this.authService.getUserRole();
  }



  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
