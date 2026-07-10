export interface SetMenuLineTranslationDTO {
  locale: string;
  translatedText: string;
}

export interface SetMenuLineDTO {
  setMenuLineId?: string;
  sortOrder: number;
  text: string;
  vatPercent?: number;
  translations?: SetMenuLineTranslationDTO[];
}

export interface SetMenuLineInput {
  text: string;
  vatPercent: number;
}

export interface SetMenuDTO {
  setMenuId?: string;
  restaurantId?: string;
  weekday: number;
  title: string;
  priceAmount: number;
  priceCurrency?: string;
  isAvailable: boolean;
  linkedMenuItemId: string;
  sourceLocale?: string;
  lines: SetMenuLineDTO[];
}

export interface WeeklySetMenuResponse {
  days: SetMenuDTO[];
}

export function setMenuLineTexts(setMenu: SetMenuDTO, locale?: string): string[] {
  const lang = (locale ?? '').toLowerCase();
  return (setMenu.lines ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(line => {
      if (lang && line.translations?.length) {
        const hit = line.translations.find(t => t.locale?.toLowerCase() === lang);
        if (hit?.translatedText) return hit.translatedText;
      }
      return line.text;
    });
}

export function maxSetMenuLineVatPercent(lines: SetMenuLineDTO[] | null | undefined): number {
  const values = (lines ?? [])
    .map(line => line.vatPercent)
    .filter((value): value is number => Number.isFinite(value));
  return values.length ? Math.max(...values) : 19;
}

/** True when an order line is the daily set menu (linked placeholder or SetMenu category). */
export function isSetMenuOrderLine(
  menuItemId: string,
  category: string | number | null | undefined,
  linkedMenuItemId?: string | null
): boolean {
  if (linkedMenuItemId && menuItemId === linkedMenuItemId) return true;
  const raw = String(category ?? '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower === 'setmenu' || raw === '16';
}

export function setMenuToMenuItem(setMenu: SetMenuDTO, locale?: string) {
  const lines = setMenuLineTexts(setMenu, locale);
  return {
    menuItemId: setMenu.linkedMenuItemId,
    menuItemName: setMenu.title,
    menuItemDescription: lines.join('\n'),
    menuItemPriceAmount: setMenu.priceAmount,
    menuItemPriceCurrency: setMenu.priceCurrency,
    menuItemVatPercent: maxSetMenuLineVatPercent(setMenu.lines),
    category: 'SetMenu',
    isAvailable: setMenu.isAvailable,
  };
}
