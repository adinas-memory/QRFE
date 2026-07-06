export type StaffPickupKind = 'kitchen' | 'bar';

const TTL_MS = 15_000;
const inFlightKeys = new Set<string>();

function storageKey(kind: StaffPickupKind, restaurantId: string, tableId: string): string {
  return `qrfe-pickup:${kind}:${restaurantId}:${tableId}`;
}

/** Cross-tab + in-memory guard for kitchen/bar POST …/pickup. */
export function tryBeginStaffPickupCall(
  kind: StaffPickupKind,
  restaurantId: string,
  tableId: string,
): boolean {
  const key = storageKey(kind, restaurantId, tableId);
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

export function endStaffPickupCall(
  kind: StaffPickupKind,
  restaurantId: string,
  tableId: string,
): void {
  const key = storageKey(kind, restaurantId, tableId);
  inFlightKeys.delete(key);
  // Keep sessionStorage entry until TTL expires — blocks rapid double-tap after slow responses.
}
