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
    private router: Router) {

  }


  handleCardClick(card: SubscriptionProductModel): void {
    this.subscriptionService.setPendingPlan({
      priceId: card.priceId,
      restaurantType: card.restaurantType
    });

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
    this.authService.logout();
  }



  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
