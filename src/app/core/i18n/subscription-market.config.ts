import { type AppLang } from './transloco.config';

export const SUBSCRIPTION_MARKETS = ['RO', 'IT', 'US'] as const;
export type SubscriptionMarket = (typeof SUBSCRIPTION_MARKETS)[number];

const LANG_TO_MARKET: Record<AppLang, SubscriptionMarket> = {
  ro: 'RO',
  it: 'IT',
  en: 'US',
  fr: 'US',
  es: 'US',
  de: 'US',
  sv: 'US',
};

export function marketFromLang(lang: string | null | undefined): SubscriptionMarket {
  const normalized = (lang ?? '').trim().toLowerCase();
  if (normalized in LANG_TO_MARKET) {
    return LANG_TO_MARKET[normalized as AppLang];
  }
  return 'US';
}

export function isSubscriptionMarket(value: string | null | undefined): value is SubscriptionMarket {
  return SUBSCRIPTION_MARKETS.includes((value ?? '').toUpperCase() as SubscriptionMarket);
}
