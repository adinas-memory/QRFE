import { ProductLimitModel, RestaurantType, SubscriptionProductModel } from '../../../core/models/subscription-product';

/** Production catalog — used when `/api/stripe/subscription` is empty or unreachable. */
export const LANDING_SUBSCRIPTION_FALLBACK: readonly SubscriptionProductModel[] = [
  {
    productPriceId: '019eb58c-d66c-73c1-9963-aec7d4a28651',
    priceId: 'price_1TmvtlKE3KeCSeymPp1w6RdI',
    restaurantType: 'small',
    description: 'PICO - Suitable for small bars and restaurants with maximum 10 tables',
    features: JSON.stringify([
      'pricing.features.cardPayments',
      'pricing.features.qrMenu',
      'pricing.features.callWaiter',
      'pricing.features.reports',
      'pricing.features.bookings',
      'pricing.features.realtimeUpdates',
      'pricing.features.offlineFirst',
      'pricing.features.sseTablesLive',
      'pricing.features.multilanguageUI',
      'pricing.features.menuUnavailable',
      'pricing.features.paymentLock',
      'pricing.features.kitchenBarScreens',
      'pricing.features.ecoBon',
      'pricing.features.menuDescriptionTranslation',
    ]),
    priceAmount: 19,
    priceCurrency: 'EUR',
    subscriptionInterval: 'month',
  },
  {
    productPriceId: '019eb712-5700-772e-bc97-f47b32f9c504',
    priceId: 'price_1TmvtsKE3KeCSeymofaiKGv7',
    restaurantType: 'medium',
    description: 'MEZZO - For restaurants with maximum 25 tables',
    features: JSON.stringify([
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
      'pricing.features.sseTablesLive',
      'pricing.features.ecoBon',
      'pricing.features.menuDescriptionTranslation',
    ]),
    priceAmount: 39,
    priceCurrency: 'EUR',
    subscriptionInterval: 'month',
  },
  {
    productPriceId: '019eb718-ff2b-71db-9bf9-f8e1ed696157',
    priceId: 'price_1TmvuFKE3KeCSeymLXpGrfoO',
    restaurantType: 'large',
    description: 'MAGNO - Going big? This is for you if you have to administrate up to 50 customer tables',
    features: JSON.stringify([
      'pricing.features.qrMenu',
      'pricing.features.cardPayments',
      'pricing.features.callWaiter',
      'pricing.features.reports',
      'pricing.features.bookings',
      'pricing.features.realtimeUpdates',
      'pricing.features.offlineFirst',
      'pricing.features.kitchenBarScreens',
      'pricing.features.menuUnavailable',
      'pricing.features.paymentLock',
      'pricing.features.sseTablesLive',
      'pricing.features.multilanguageUI',
      'pricing.features.ecoBon',
      'pricing.features.menuDescriptionTranslation',
    ]),
    priceAmount: 69,
    priceCurrency: 'EUR',
    subscriptionInterval: 'month',
  },
];

export const LANDING_PRODUCT_LIMITS_FALLBACK: readonly ProductLimitModel[] = [
  { type: RestaurantType.Small, maxTables: 10, maxBars: 1, maxBarSeats: 5 },
  { type: RestaurantType.Medium, maxTables: 25, maxBars: 2, maxBarSeats: 10 },
  { type: RestaurantType.Large, maxTables: 50, maxBars: 3, maxBarSeats: 15 },
];

export function sortSubscriptionProducts(products: SubscriptionProductModel[]): SubscriptionProductModel[] {
  const order: Record<string, number> = { small: 0, medium: 1, large: 2 };
  return [...products].sort((a, b) => {
    const av = order[(a.restaurantType ?? '').toLowerCase()] ?? 99;
    const bv = order[(b.restaurantType ?? '').toLowerCase()] ?? 99;
    return av - bv;
  });
}

export function resolveLandingSubscriptionProducts(
  products: SubscriptionProductModel[] | null | undefined,
): SubscriptionProductModel[] {
  const list = products?.length ? products : [...LANDING_SUBSCRIPTION_FALLBACK];
  return sortSubscriptionProducts(list);
}
