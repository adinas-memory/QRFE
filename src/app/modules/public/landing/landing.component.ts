import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { 
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

type CardColor = {
  color: string
  textColor?: string
}
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RowComponent, ColComponent, CardComponent, CardHeaderComponent, CardBodyComponent, NgTemplateOutlet, CardTitleDirective, CardTextDirective, ButtonDirective, CardSubtitleDirective, CardLinkDirective, RouterLink, ListGroupDirective, ListGroupItemDirective, CardFooterComponent, BorderDirective, CardGroupComponent, GutterDirective, CardImgDirective, TabsComponent, TabsListComponent, TabDirective, TabsContentComponent, TabPanelComponent, RouterLink, NgTemplateOutlet],
  templateUrl: './landing.component.html'  
})
export class LandingComponent implements OnInit {
  cards: SubscriptionProduct[] = [];

  constructor(private subscriptionService: SubscriptionService) {}

  ngOnInit(): void {
    this.subscriptionService.getSubscriptionProducts().subscribe({
      next: products => {
        this.cards = products;
      },
      error: err => {
        console.error('Failed to load subscriptions', err);
      }
    });
  }
}