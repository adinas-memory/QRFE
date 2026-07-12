import {
  EMPTY_RESTAURANT_ID,
  isAssignedRestaurantId,
  mergeRestaurantId,
  normalizeRestaurantId,
  shouldRunRestaurantRealtimeSync,
} from './restaurant-id.util';

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

  it('allows realtime sync only for manager and staff', () => {
    expect(shouldRunRestaurantRealtimeSync('manager')).toBeTrue();
    expect(shouldRunRestaurantRealtimeSync('staff')).toBeTrue();
    expect(shouldRunRestaurantRealtimeSync('reseller')).toBeFalse();
    expect(shouldRunRestaurantRealtimeSync('gadmin')).toBeFalse();
  });

  it('clears stale restaurant id for reseller ping responses', () => {
    expect(mergeRestaurantId('reseller', null, '019c1a13-db50-763a-8cde-4a39922a538d')).toBeNull();
  });

  it('preserves restaurant id for manager when ping omits it', () => {
    expect(mergeRestaurantId('manager', null, '019c1a13-db50-763a-8cde-4a39922a538d'))
      .toBe('019c1a13-db50-763a-8cde-4a39922a538d');
  });
});
