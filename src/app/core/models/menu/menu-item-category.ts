import { MenuItemCategory } from './menuItem';

const DRINK_CATEGORY_VALUES: readonly MenuItemCategory[] = [
  MenuItemCategory.RedWine,
  MenuItemCategory.WhiteWine,
  MenuItemCategory.RoseWine,
  MenuItemCategory.Beer,
  MenuItemCategory.Beverage,
  MenuItemCategory.Cocktail,
  MenuItemCategory.Coffee,
  MenuItemCategory.Tea,
];

const DRINK_CATEGORY_SET = new Set<string>(DRINK_CATEGORY_VALUES);

export function isDrinkCategory(category: string | null | undefined): boolean {
  return !!category && DRINK_CATEGORY_SET.has(category);
}

export function isFoodCategory(category: string | null | undefined): boolean {
  return !!category && !isDrinkCategory(category);
}
