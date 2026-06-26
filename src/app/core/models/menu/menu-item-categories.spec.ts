import { MenuItemCategory } from './menuItem';
import {
  MANAGEMENT_MENU_CATEGORIES,
  mergeManagementCategories,
} from './menu-item-categories';

describe('menu-item-categories', () => {
  it('excludes SetMenu from management categories', () => {
    expect(MANAGEMENT_MENU_CATEGORIES).not.toContain(MenuItemCategory.SetMenu);
    expect(MANAGEMENT_MENU_CATEGORIES).toContain(MenuItemCategory.Pizza);
  });

  it('mergeManagementCategories ignores SetMenu from API', () => {
    const merged = mergeManagementCategories(['Pizza', 'SetMenu', 'setmenu']);
    expect(merged).not.toContain(MenuItemCategory.SetMenu);
    expect(merged).toContain(MenuItemCategory.Pizza);
  });
});
