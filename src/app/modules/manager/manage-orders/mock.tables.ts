import { TableDTO, Currency, MenuItemCategory } from '../../../core/models/restaurantTablesModel';


export const mockTables: TableDTO[] = [
  {
    restaurantId: 'resto-001',
    tableId: 'T1',
    tableName: 'Table 1',
    isTableOpen: true,
    isWaiterCalled: false,
    order: {
      restaurantId: 'resto-001',
      orderId: 'ORD-1001',
      tableId: 'T1',
      createdOn: new Date().toISOString(),
      isOrderOpen: true,
      currency: Currency.EUR,
      orderItems: [
        {
          orderItemId: 'OI-1',
          menuItemId: 'M-101',
          orderItemName: 'Bruschetta',
          orderItemPriceAmount: 6.5,
          orderItemPriceCurrency: Currency.EUR,
          orderItemDescription: 'Grilled bread with tomato and basil',
          category: MenuItemCategory.Appetizer,
          quantity: 2
        },
        {
          orderItemId: 'OI-2',
          menuItemId: 'M-102',
          orderItemName: 'Margherita Pizza',
          orderItemPriceAmount: 9.0,
          orderItemPriceCurrency: Currency.EUR,
          orderItemDescription: 'Classic pizza with tomato, mozzarella, basil',
          category: MenuItemCategory.Pizza,
          quantity: 1
        }
      ],
      subTotal: { amount: 21.0, currency: Currency.EUR },
      finalTotalPrice: { amount: 21.0, currency: Currency.EUR }
    }
  },
  {
    restaurantId: 'resto-001',
    tableId: 'T2',
    tableName: 'Table 2',
    isTableOpen: false,
    isWaiterCalled: false,
    order: {
      restaurantId: 'resto-001',
      orderId: 'ORD-1002',
      tableId: 'T2',
      createdOn: new Date(Date.now() - 3600 * 1000).toISOString(),
      closedAt: new Date().toISOString(),
      isOrderOpen: true,
      currency: Currency.EUR,
      orderItems: [
        {
          orderItemId: 'OI-3',
          menuItemId: 'M-201',
          orderItemName: 'Tiramisu',
          orderItemPriceAmount: 5.5,
          orderItemPriceCurrency: Currency.EUR,
          orderItemDescription: 'Coffee-flavored Italian dessert',
          category: MenuItemCategory.Dessert,
          quantity: 2
        },
        {
          orderItemId: 'OI-4',
          menuItemId: 'M-202',
          orderItemName: 'Chianti Red Wine',
          orderItemPriceAmount: 15.0,
          orderItemPriceCurrency: Currency.EUR,
          orderItemDescription: 'Glass of Chianti Classico',
          category: MenuItemCategory.RedWine,
          quantity: 1
        }
      ],
      subTotal: { amount: 26.0, currency: Currency.EUR },
      finalTotalPrice: { amount: 26.0, currency: Currency.EUR }
    }
  },
  {
    restaurantId: 'resto-001',
    tableId: 'T3',
    tableName: 'Table 3',
    isTableOpen: false,
    isWaiterCalled: false,
    order: {
      restaurantId: 'resto-001',
      orderId: 'ORD-1003',
      tableId: 'T3',
      createdOn: new Date().toISOString(),
      isOrderOpen: false,
      currency: Currency.EUR,
      orderItems: [
        {
          orderItemId: 'OI-5',
          menuItemId: 'M-301',
          orderItemName: 'Beer Draft',
          orderItemPriceAmount: 4.0,
          orderItemPriceCurrency: Currency.EUR,
          orderItemDescription: 'Cold draft beer',
          category: MenuItemCategory.Beer,
          quantity: 3
        }
      ],
      subTotal: { amount: 12.0, currency: Currency.EUR },
      finalTotalPrice: { amount: 12.0, currency: Currency.EUR }
    }
  }
];
