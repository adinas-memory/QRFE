import { cartLineFromOrderRaw, isBarCartLine, isKitchenCartLine, menuItemsByIdMap } from './cart-item-category';
import { MenuItemCategory } from './menuItem';

describe('cart-item-category', () => {
  const appetizer = {
    menuItemId: 'food-id',
    menuItemName: 'Soup',
    menuItemPriceAmount: 10,
    category: 'Appetizer',
  };
  const redWine = {
    menuItemId: 'abc-def',
    menuItemName: 'Merlot',
    menuItemPriceAmount: 10,
    category: 'Appetizer',
  };
  const menuById = menuItemsByIdMap([appetizer as any, redWine as any]);

  it('prefers order-line category over stale menu cache', () => {
    const line = cartLineFromOrderRaw({
      menuItemId: 'ABC-DEF',
      category: 'redWine',
      quantity: 1,
      orderItemName: 'Merlot',
    }, menuById);
    expect(line.item.category).toBe(MenuItemCategory.RedWine);
    expect(isBarCartLine(line)).toBe(true);
  });

  it('resolves numeric drink category when menu lookup fails', () => {
    const line = cartLineFromOrderRaw({
      menuItemId: 'missing-id',
      category: 8,
      quantity: 1,
      orderItemName: 'Rose',
    }, {});
    expect(isBarCartLine(line)).toBe(true);
    expect(line.item.category).toBe(MenuItemCategory.RoseWine);
  });

  it('falls back to menu category when order line carries default Appetizer sentinel', () => {
    const wineMenu = {
      menuItemId: 'wine-id',
      menuItemName: 'Merlot',
      menuItemPriceAmount: 10,
      category: MenuItemCategory.RedWine,
    };
    const byId = menuItemsByIdMap([wineMenu as any]);
    const line = cartLineFromOrderRaw({
      menuItemId: 'wine-id',
      category: 'appetizer',
      quantity: 1,
      orderItemName: 'Merlot',
    }, byId);
    expect(line.item.category).toBe(MenuItemCategory.RedWine);
    expect(isBarCartLine(line)).toBe(true);
    expect(isKitchenCartLine(line)).toBe(false);
  });
});
