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

/** Explicit index map — must match backend `MenuItemCategory` enum order. */
const CATEGORY_BY_INDEX: readonly MenuItemCategory[] = [
  MenuItemCategory.Appetizer,
  MenuItemCategory.Starter,
  MenuItemCategory.FirstCourse,
  MenuItemCategory.SecondCourse,
  MenuItemCategory.Pizza,
  MenuItemCategory.Dessert,
  MenuItemCategory.RedWine,
  MenuItemCategory.WhiteWine,
  MenuItemCategory.RoseWine,
  MenuItemCategory.Beer,
  MenuItemCategory.Beverage,
  MenuItemCategory.Cocktail,
  MenuItemCategory.Coffee,
  MenuItemCategory.Tea,
  MenuItemCategory.Pasta,
  MenuItemCategory.Salad,
  MenuItemCategory.SetMenu,
];

const ALL_CATEGORY_VALUES = Object.values(MenuItemCategory).filter(
  (v): v is MenuItemCategory => typeof v === 'string',
);

/** Normalize API/SSE category values (PascalCase, camelCase, or numeric enum index). */
export function normalizeMenuItemCategory(category: string | number | null | undefined): string | null {
  if (category == null) return null;
  if (typeof category === 'number' && Number.isFinite(category)) {
    const idx = Math.trunc(category);
    if (idx >= 0 && idx < CATEGORY_BY_INDEX.length) {
      return CATEGORY_BY_INDEX[idx];
    }
  }

  const raw = String(category).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const idx = Number.parseInt(raw, 10);
    if (idx >= 0 && idx < CATEGORY_BY_INDEX.length) {
      return CATEGORY_BY_INDEX[idx];
    }
  }

  const exact = ALL_CATEGORY_VALUES.find(v => v === raw);
  if (exact) return exact;

  const lower = raw.toLowerCase();
  const caseInsensitive = ALL_CATEGORY_VALUES.find(v => v.toLowerCase() === lower);
  return caseInsensitive ?? raw;
}

export function isDrinkCategory(category: string | number | null | undefined): boolean {
  const normalized = normalizeMenuItemCategory(category);
  if (!normalized) return false;
  return (DRINK_CATEGORY_VALUES as readonly string[]).includes(normalized);
}

export function isFoodCategory(category: string | number | null | undefined): boolean {
  const normalized = normalizeMenuItemCategory(category);
  if (!normalized) return false;
  if (normalized === MenuItemCategory.SetMenu) return true;
  return !isDrinkCategory(normalized);
}

export function isSetMenuCategory(category: string | number | null | undefined): boolean {
  const normalized = normalizeMenuItemCategory(category);
  return normalized === MenuItemCategory.SetMenu || normalized === '16';
}
