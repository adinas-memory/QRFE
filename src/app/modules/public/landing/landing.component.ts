import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AuthService, UserContext } from '../../../core/auth/auth.service';
import {
  ContainerComponent,
  HeaderComponent,
  HeaderDividerComponent,  
  NavItemComponent,
  HeaderNavComponent,
  HeaderTextComponent,
  NavLinkDirective,
  BorderDirective,
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardFooterComponent,
  CardGroupComponent,
  CardHeaderComponent,
  CardImgDirective,
  CardLinkDirective,
  CardSubtitleDirective,
  CardTextDirective,
  CardTitleDirective,
  ColComponent,
  GutterDirective,
  ListGroupDirective,
  ListGroupItemDirective,
  RowComponent,
  TabDirective,
  TabPanelComponent,
  TabsComponent,
  TabsContentComponent,
  TabsListComponent
 } from '@coreui/angular';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionProduct } from '../../../core/models/subscription-product';
import { Subscription } from 'rxjs';

type CardColor = {
  color: string
  textColor?: string
}
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
    CardHeaderComponent, 
    CardBodyComponent, 
    NgTemplateOutlet, 
    CardTitleDirective, 
    CardTextDirective, 
    ButtonDirective, 
    CardSubtitleDirective, 
    CardLinkDirective, 
    ListGroupDirective, 
    ListGroupItemDirective, CardFooterComponent, BorderDirective, CardGroupComponent, GutterDirective, CardImgDirective, TabsComponent, TabsListComponent, TabDirective, TabsContentComponent, TabPanelComponent],
  templateUrl: './landing.component.html'
})
export class LandingComponent implements OnInit {
  public cards: SubscriptionProduct[] = [];
  private userSubscription: Subscription | any;
  private user : UserContext | any;

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router) {}


handleCardClick(card: SubscriptionProduct): void {
  if (!this.user || this.user.role === 'default') {
    this.router.navigate(['/register']); // or ['/login']
  } else {
    // Proceed with subscription logic
    console.log('User can subscribe to:', card.restaurantType);
  }
}



  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(

      (userData) => {
        this.user = userData;
        console.log('User data received:', this.user);
      },
      (error) => {
        console.error('Error fetching user data:', error);
      }

    );
    this.subscriptionService.getSubscriptionProducts().subscribe({
      next: products => {
        this.cards = products;
      },
      error: err => {
        console.error('Failed to load subscriptions', err);
      }
    });
  }

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
