import { ProductLimitModel, RestaurantType, SubscriptionProductModel } from '../../../core/models/subscription-product';
import { SubscriptionMarket } from '../../../core/i18n/subscription-market.config';

const FEATURE_KEYS = [
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
  'pricing.features.unlimitedDevicesPerRestaurant',
] as const;

function buildFallbackProduct(
  market: SubscriptionMarket,
  restaurantType: 'small' | 'medium' | 'large',
  title: string,
  subtitle: string,
  priceAmount: number,
  priceCurrency: string,
  priceId: string,
  productPriceId: string,
): SubscriptionProductModel {
  return {
    productPriceId,
    priceId,
    market,
    restaurantType,
    description: `${title} - ${subtitle}`,
    features: JSON.stringify([...FEATURE_KEYS]),
    priceAmount,
    priceCurrency,
    subscriptionInterval: 'month',
  };
}

/** Production catalog per market — used when `/api/stripe/subscription` is empty or unreachable. */
export const LANDING_SUBSCRIPTION_FALLBACK_BY_MARKET: Record<SubscriptionMarket, readonly SubscriptionProductModel[]> = {
  RO: [
    buildFallbackProduct('RO', 'small', 'PICO', 'Potrivit pentru baruri și restaurante mici cu maximum 10 mese', 89, 'RON', 'price_fallback_ro_small', '019eb58c-d66c-73c1-9963-aec7d4a28651'),
    buildFallbackProduct('RO', 'medium', 'MEZZO', 'Pentru restaurante cu maximum 25 mese', 179, 'RON', 'price_fallback_ro_medium', '019eb712-5700-772e-bc97-f47b32f9c504'),
    buildFallbackProduct('RO', 'large', 'MAGNO', 'Pentru restaurante cu până la 50 mese', 299, 'RON', 'price_fallback_ro_large', '019eb718-ff2b-71db-9bf9-f8e1ed696157'),
  ],
  IT: [
    buildFallbackProduct('IT', 'small', 'PICO', 'Adatto a bar e ristoranti piccoli con massimo 10 tavoli', 19, 'EUR', 'price_fallback_it_small', '019eb58c-d66c-73c1-9963-aec7d4a28652'),
    buildFallbackProduct('IT', 'medium', 'MEZZO', 'Per ristoranti con massimo 25 tavoli', 39, 'EUR', 'price_fallback_it_medium', '019eb712-5700-772e-bc97-f47b32f9c505'),
    buildFallbackProduct('IT', 'large', 'MAGNO', 'Per ristoranti con fino a 50 tavoli', 69, 'EUR', 'price_fallback_it_large', '019eb718-ff2b-71db-9bf9-f8e1ed696158'),
  ],
  US: [
    buildFallbackProduct('US', 'small', 'PICO', 'Suitable for small bars and restaurants with maximum 10 tables', 19, 'USD', 'price_1TmvtlKE3KeCSeymPp1w6RdI', '019eb58c-d66c-73c1-9963-aec7d4a28651'),
    buildFallbackProduct('US', 'medium', 'MEZZO', 'For restaurants with maximum 25 tables', 39, 'USD', 'price_1TmvtsKE3KeCSeymofaiKGv7', '019eb712-5700-772e-bc97-f47b32f9c504'),
    buildFallbackProduct('US', 'large', 'MAGNO', 'Going big? This is for you if you have to administrate up to 50 customer tables', 69, 'USD', 'price_1TmvuFKE3KeCSeymLXpGrfoO', '019eb718-ff2b-71db-9bf9-f8e1ed696157'),
  ],
};

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
  market: SubscriptionMarket,
): SubscriptionProductModel[] {
  const list = products?.length ? products : [...LANDING_SUBSCRIPTION_FALLBACK_BY_MARKET[market]];
  return sortSubscriptionProducts(list);
}
