import { MenuItemCategory } from './menuItem';

/** PascalCase category names valid for à la carte manager UI (excludes SetMenu). */
export const MANAGEMENT_MENU_CATEGORIES: readonly string[] = Object.values(MenuItemCategory).filter(
  (category) => category !== MenuItemCategory.SetMenu,
);

export function canonicalMenuItemCategory(value: string | null | undefined): string {
  if (!value) return '';
  const hit = MANAGEMENT_MENU_CATEGORIES.find(
    (c) => c.toLowerCase() === value.toLowerCase()
  );
  return hit ?? value;
}

export function mergeManagementCategories(apiCategories: string[] | null | undefined): string[] {
  const merged = new Set<string>(MANAGEMENT_MENU_CATEGORIES);
  for (const c of apiCategories ?? []) {
    const canonical = canonicalMenuItemCategory(c);
    if (canonical && canonical.toLowerCase() !== 'setmenu') {
      merged.add(canonical);
    }
  }
  return [...merged];
}
