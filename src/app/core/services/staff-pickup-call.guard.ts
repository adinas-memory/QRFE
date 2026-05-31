const TTL_MS = 15_000;
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

  inFlightKeys.add(key);

  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const at = Number(raw);
      if (Number.isFinite(at) && now - at < TTL_MS) {
        inFlightKeys.delete(key);
        return false;
      }
    }
    sessionStorage.setItem(key, String(now));
  } catch {
    // ignore storage errors (private mode)
  }

  return true;
}

export function endStaffPickupCall(restaurantId: string, tableId: string): void {
  const key = storageKey(restaurantId, tableId);
  inFlightKeys.delete(key);
  // Keep sessionStorage entry until TTL expires — blocks rapid double-tap after slow responses.
}
