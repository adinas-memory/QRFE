import { Currency } from './restaurantTablesModel';
import {
  cartItemsFromSseLines,
  orderDtoFromSsePayload,
  orderItemDtoFromSseLine,
  OrderUpdatedSSEPayload,
} from './orderingModel';

describe('orderingModel SSE helpers', () => {
  const line = {
    OrderItemId: 'oi-1',
    MenuItemId: 'menu-1',
    OrderItemName: 'Pizza',
    Quantity: 2,
    OrderItemPriceAmount: 10,
    OrderItemPriceCurrency: Currency.RON,
    Category: 'Main',
  };

  it('orderItemDtoFromSseLine maps PascalCase fields', () => {
    const dto = orderItemDtoFromSseLine(line);
    expect(dto.orderItemId).toBe('oi-1');
    expect(dto.menuItemId).toBe('menu-1');
    expect(dto.orderItemName).toBe('Pizza');
    expect(dto.quantity).toBe(2);
  });

  it('cartItemsFromSseLines builds cart lines', () => {
    const cart = cartItemsFromSseLines([line]);
    expect(cart.length).toBe(1);
    expect(cart[0].quantity).toBe(2);
    expect(cart[0].orderItemId).toBe('oi-1');
  });

  it('orderDtoFromSsePayload builds open order with items', () => {
    const payload: OrderUpdatedSSEPayload = {
      RestaurantId: 'r1',
      TableId: 't1',
      OrderId: 'order-1',
      SubTotal: { Amount: 20, Currency: 'RON' },
      ItemCount: 2,
      LastAddedItem: 'Pizza',
      LastActionAt: '2026-01-01T12:00:00.000Z',
      Items: [line],
    };
    const order = orderDtoFromSsePayload('t1', payload, 'Maria');
    expect(order.orderId).toBe('order-1');
    expect(order.isOrderOpen).toBeTrue();
    expect(order.orderItems?.length).toBe(1);
    expect(order.lastInitiatedBy).toBe('Maria');
  });
});
