export interface SubscriptionProductModel {
  productPriceId: string;
  priceId: string;
  market?: string;
  restaurantType: string;
  description: string;
  features: string;
  priceAmount: number;
  priceCurrency: string;
  subscriptionInterval: string;
}

export interface CreateSubscriptionProductModel {
  market: string;
  restaurantType: string;
  description: string;
  features: string;  
  priceAmount: number;
  priceCurrency: string;
  subscriptionInterval: string;
  usageType: string;
}


export enum RestaurantType {
  Small = 'small',
  Medium = 'medium',
  Large = 'large'
}

export interface ProductLimitModel {
  type: RestaurantType;
  maxTables: number;
  maxBars: number;
  maxBarSeats: number;
}

