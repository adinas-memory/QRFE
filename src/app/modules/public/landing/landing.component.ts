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
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SubscriptionProductModel } from '../../../core/models/subscription-product';
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
  private user : UserContextModel | any;

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private router: Router) {}


handleCardClick(card: SubscriptionProductModel): void {
  if (!this.user || this.user.role === 'default') {
    this.router.navigate(['/login']);
  } else {
    this.router.navigate(['/subscribe']);
  }
}



ngOnInit(): void {
  this.subscriptionService.loadProducts();
  this.subscriptionService.getProducts().subscribe({
    next: products => this.cards = products
  });

  // this.userSubscription = this.authService.user$.subscribe(userData => {
  //   this.user = userData;

  //   // THIS ON THE LOGIN PAGE AFTER SUCCESSFUL LOGIN
  //   const pending = this.subscriptionService.getPendingPlan();
  //   if (this.user && pending) {
  //     this.subscriptionService.subscribeToPlan(pending).subscribe({
  //       next: () => {
  //         console.log('Subscribed successfully');
  //         this.subscriptionService.clearPendingPlan();
  //       },
  //       error: err => console.error('Subscription failed', err)
  //     });
  //   }
  // });
}

  ngOnDestroy() {
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }
}
