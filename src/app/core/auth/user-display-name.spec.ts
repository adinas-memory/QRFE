import { formatStaffDisplayName } from './user-display-name';

describe('formatStaffDisplayName', () => {
  it('formats surname and first-name initial', () => {
    expect(formatStaffDisplayName({ name: 'Ion', surname: 'Popescu' })).toBe('Popescu I.');
  });

  it('uses displayName when provided', () => {
    expect(formatStaffDisplayName({ displayName: 'Popescu I.' })).toBe('Popescu I.');
  });

  it('uses displayName fallback for concatenated values', () => {
    expect(formatStaffDisplayName({ displayName: 'Ion Popescu' })).toBe('Popescu I.');
  });

  it('uses email fallback when name parts missing', () => {
    expect(formatStaffDisplayName({ email: 'manager@restaurant.ro' })).toBe('manager');
  });
});
