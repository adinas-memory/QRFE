import { EMPTY_RESTAURANT_ID, isAssignedRestaurantId, normalizeRestaurantId } from './restaurant-id.util';

describe('restaurant-id.util', () => {
  it('treats empty guid as unassigned', () => {
    expect(isAssignedRestaurantId(EMPTY_RESTAURANT_ID)).toBeFalse();
    expect(normalizeRestaurantId(EMPTY_RESTAURANT_ID)).toBeNull();
  });

  it('accepts real restaurant ids', () => {
    const id = '019c1a13-db50-763a-8cde-4a39922a538d';
    expect(isAssignedRestaurantId(id)).toBeTrue();
    expect(normalizeRestaurantId(id)).toBe(id);
  });
});
