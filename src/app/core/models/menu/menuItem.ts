export interface MenuItem {
  menuItemId: string;
  menuItemName: string;
  menuItemDescription?: string;
  menuItemPriceAmount: number;
  category: string;
  menuItemPriceCurrency?: string;
  menuItemIconUrl?: string;
}

export interface MenuResponse {
  menu: {
    menuId: string;
    menuItems: MenuItem[];
  };
  waiterCallCount: number;
  categories: string[];
  restaurantName?: string;
}

export interface WaiterCallResponse {
  restaurantId: string;
  tableId: string;
  counterCalls: number;
  message: string;
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
  Beverage = 'Beverage',
  Cocktail = 'Cocktail'
}
