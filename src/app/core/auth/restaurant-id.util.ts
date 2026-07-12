/** Placeholder restaurant id for users not yet linked to a venue (registration / onboarding). */
export const EMPTY_RESTAURANT_ID = '00000000-0000-0000-0000-000000000000';

const ROLES_WITHOUT_ASSIGNED_RESTAURANT = new Set(['reseller', 'gadmin', 'default']);

export function isAssignedRestaurantId(id: string | null | undefined): id is string {
  if (id == null) return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== EMPTY_RESTAURANT_ID;
}

export function normalizeRestaurantId(id: string | null | undefined): string | null {
  return isAssignedRestaurantId(id) ? id.trim() : null;
}

/** Staff POS flows only — resellers/gadmins must not open SSE or offline-sync locks. */
export function shouldRunRestaurantRealtimeSync(role: string | null | undefined): boolean {
  const normalized = role?.toLowerCase();
  return normalized === 'manager' || normalized === 'staff';
}

export function isRoleWithoutAssignedRestaurant(role: string | null | undefined): boolean {
  const normalized = role?.toLowerCase();
  return normalized != null && ROLES_WITHOUT_ASSIGNED_RESTAURANT.has(normalized);
}

export function mergeRestaurantId(
  incomingRole: string,
  incomingRestaurantId: string | null | undefined,
  previousRestaurantId: string | null | undefined,
): string | null {
  const normalizedIncoming = normalizeRestaurantId(incomingRestaurantId);
  if (normalizedIncoming) {
    return normalizedIncoming;
  }
  if (isRoleWithoutAssignedRestaurant(incomingRole)) {
    return null;
  }
  return normalizeRestaurantId(previousRestaurantId);
}
