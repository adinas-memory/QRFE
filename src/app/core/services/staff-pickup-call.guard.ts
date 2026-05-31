const TTL_MS = 5000;
const inFlightKeys = new Set<string>();

function storageKey(restaurantId: string, tableId: string): string {
  return `qrfe-pickup:${restaurantId}:${tableId}`;
}

/** Cross-tab + in-memory guard for kitchen/bar POST …/pickup. */
export function tryBeginStaffPickupCall(restaurantId: string, tableId: string): boolean {
  const key = storageKey(restaurantId, tableId);
  const now = Date.now();

  if (inFlightKeys.has(key)) {
    return false;
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const at = Number(raw);
      if (Number.isFinite(at) && now - at < TTL_MS) {
        return false;
      }
    }
    sessionStorage.setItem(key, String(now));
  } catch {
    // ignore storage errors (private mode)
  }

  inFlightKeys.add(key);
  return true;
}

export function endStaffPickupCall(restaurantId: string, tableId: string): void {
  const key = storageKey(restaurantId, tableId);
  inFlightKeys.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
