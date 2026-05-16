export interface SetMenuLineTranslationDTO {
  locale: string;
  translatedText: string;
}

export interface SetMenuLineDTO {
  setMenuLineId?: string;
  sortOrder: number;
  text: string;
  translations?: SetMenuLineTranslationDTO[];
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

export function setMenuToMenuItem(setMenu: SetMenuDTO, locale?: string) {
  const lines = setMenuLineTexts(setMenu, locale);
  return {
    menuItemId: setMenu.linkedMenuItemId,
    menuItemName: setMenu.title,
    menuItemDescription: lines.join('\n'),
    menuItemPriceAmount: setMenu.priceAmount,
    menuItemPriceCurrency: setMenu.priceCurrency,
    category: 'SetMenu',
    isAvailable: setMenu.isAvailable,
  };
}
