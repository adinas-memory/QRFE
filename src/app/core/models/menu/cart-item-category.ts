import { CartItem } from '../orderingModel';
import { MenuItem, MenuItemCategory } from './menuItem';
import { isDrinkCategory, isFoodCategory, normalizeMenuItemCategory } from './menu-item-category';

/** Case-insensitive menu lookup map (lowercase GUID keys). */
export function menuItemsByIdMap(menuItems: MenuItem[]): Record<string, MenuItem> {
  const map: Record<string, MenuItem> = {};
  for (const mi of menuItems) {
    if (!mi?.menuItemId) continue;
    map[mi.menuItemId.toLowerCase()] = menuItemWithNormalizedCategory(mi);
  }
  return map;
}

export function lookupMenuItem(
  menuItemsById: Record<string, MenuItem | undefined>,
  menuItemId: string,
): MenuItem | undefined {
  if (!menuItemId) return undefined;
  return menuItemsById[menuItemId.toLowerCase()] ?? menuItemsById[menuItemId];
}

export function menuItemWithNormalizedCategory(item: MenuItem): MenuItem {
  const category = normalizeMenuItemCategory(item.category) ?? item.category ?? 'Unknown';
  return category === item.category ? item : { ...item, category };
}

export function categoryFromOrderLine(
  rawCategory: unknown,
  menuItem?: MenuItem,
): string {
  const fromOrder = normalizeMenuItemCategory(rawCategory as string | number | null | undefined);
  const fromMenu = normalizeMenuItemCategory(menuItem?.category);

  // Table-list API used to omit Category → EF default enum 0 (Appetizer). Prefer menu when it disagrees.
  if (
    fromOrder === MenuItemCategory.Appetizer
    && fromMenu
    && fromMenu !== MenuItemCategory.Appetizer
  ) {
    return fromMenu;
  }

  if (fromOrder) return fromOrder;
  if (fromMenu) return fromMenu;
  return menuItem?.category || String(rawCategory ?? 'Unknown');
}

export function cartLineFromOrderRaw(
  raw: Record<string, unknown>,
  menuItemsById: Record<string, MenuItem | undefined>,
): CartItem {
  const menuItemId = String(raw['MenuItemId'] ?? raw['menuItemId'] ?? '');
  const orderItemId = (raw['OrderItemId'] ?? raw['orderItemId']) as string | undefined;
  const qty = Number(raw['Quantity'] ?? raw['quantity'] ?? 0);
  const mi = lookupMenuItem(menuItemsById, menuItemId);
  const rawCategory = raw['Category'] ?? raw['category'];
  const orderName = String(raw['OrderItemName'] ?? raw['orderItemName'] ?? '');
  const resolvedCategory = categoryFromOrderLine(rawCategory, mi);

  if (mi) {
    return {
      item: menuItemWithNormalizedCategory({
        ...mi,
        menuItemName: orderName || mi.menuItemName,
        category: resolvedCategory,
      }),
      quantity: qty,
      orderItemId,
    };
  }

  return {
    item: {
      menuItemId,
      menuItemName: orderName || '—',
      menuItemDescription: String(raw['OrderItemDescription'] ?? raw['orderItemDescription'] ?? ''),
      menuItemPriceAmount: Number(raw['OrderItemPriceAmount'] ?? raw['orderItemPriceAmount'] ?? 0),
      menuItemPriceCurrency: String(raw['OrderItemPriceCurrency'] ?? raw['orderItemPriceCurrency'] ?? '').trim().toUpperCase() || undefined,
      menuItemIconUrl: undefined,
      category: resolvedCategory,
    },
    quantity: qty,
    orderItemId,
  };
}

export function isBarCartLine(c: CartItem): boolean {
  return isDrinkCategory(c.item.category);
}

export function isKitchenCartLine(c: CartItem): boolean {
  return isFoodCategory(c.item.category);
}
