import { UserContextModel } from './../../../core/models/userContextModel';
import { Component, OnInit } from '@angular/core';
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
} from '@coreui/angular';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { SubscriptionProductModel } from '../../../core/models/subscription-product';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [ContainerComponent,
    HeaderComponent,
    HeaderDividerComponent,
    HeaderTextComponent,
    HeaderNavComponent,
    NavItemComponent,
    NavLinkDirective,
    RouterLink,
    RowComponent,
    ColComponent,
    CardComponent,
    CardBodyComponent,
    CardTitleDirective,
    CardTextDirective,
    ButtonDirective,
  ],
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  public cards: SubscriptionProductModel[] = [];
  private userSubscription: Subscription | any;
  private user: UserContextModel | any;
  private role: string | null = null;


  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router) { }


  handleCardClick(card: SubscriptionProductModel): void {
    // set pending plan and redirect to login
    this.subscriptionService.setPendingPlan({
      priceId: card.priceId,
      restaurantType: card.restaurantType
    });
    if (!this.user) {
      this.router.navigate(['/login']);
    }
    else if (this.user && this.role === 'default') {
      // implement ping()
      console.log('Navigating to restaurant setup for user:', this.user);
      this.router.navigate(['/restaurant-setup']);
    } else {
      this.router.navigate(['/404']);
    }
  }



  ngOnInit(): void {
    this.subscriptionService.clearPendingPlan();
    this.subscriptionService.loadProducts();
    this.subscriptionService.getProducts().subscribe({
      next: products => this.cards = products
    });

    this.authService.user$.subscribe(user => {
      this.user = user;
      console.warn('User authenticated in LandingComponent:', this.user);
    }, error => {
      console.error('Error fetching user data in LandingComponent:', error);
    });



    this.role = this.authService.getUserRole();
    console.warn('User role in LandingComponent:', this.role);
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }

    // this.subscriptionService.clearPendingPlan();
  }
}
