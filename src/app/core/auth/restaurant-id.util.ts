/** Placeholder restaurant id for users not yet linked to a venue (registration / onboarding). */
export const EMPTY_RESTAURANT_ID = '00000000-0000-0000-0000-000000000000';

export function isAssignedRestaurantId(id: string | null | undefined): id is string {
  if (id == null) return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== EMPTY_RESTAURANT_ID;
}

export function normalizeRestaurantId(id: string | null | undefined): string | null {
  return isAssignedRestaurantId(id) ? id.trim() : null;
}
