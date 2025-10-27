export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: MenuItemCategory;
  imageUrl?: string;
}

export interface MenuResponse {
  menu: {
    menuId: string;
    menuItems: MenuItem[];
  };
  waiterCallCount: number;
}

export enum MenuItemCategory {
  Appetizer = 'Appetizer',
  Starter = 'Starter',
  FirstCourse = 'FirstCourse',
  SecondCourse = 'SecondCourse',
  Pizza = 'Pizza',
  Dessert = 'Dessert',
  RedWine = 'RedWine',
  WhiteWine = 'WhiteWine',
  RoseWine = 'RoseWine',
  Beer = 'Beer',
  Beverage = 'Beverage'
}
