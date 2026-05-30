import {
  isDrinkCategory,
  isFoodCategory,
  normalizeMenuItemCategory,
} from './menu-item-category';
import { MenuItemCategory } from './menuItem';

describe('menu-item-category', () => {
  it('normalizes camelCase drink categories from API JSON', () => {
    expect(normalizeMenuItemCategory('beer')).toBe(MenuItemCategory.Beer);
    expect(normalizeMenuItemCategory('redWine')).toBe(MenuItemCategory.RedWine);
    expect(isDrinkCategory('beer')).toBe(true);
    expect(isDrinkCategory('redWine')).toBe(true);
  });

  it('normalizes numeric enum indices', () => {
    expect(normalizeMenuItemCategory('9')).toBe(MenuItemCategory.Beer);
    expect(isDrinkCategory('10')).toBe(true);
  });

  it('treats set menu as food only', () => {
    expect(isFoodCategory('setMenu')).toBe(true);
    expect(isDrinkCategory('setMenu')).toBe(false);
  });
});
