/** 100ms slot — spreads reconnect sync across up to 600 restaurants in a 60s window. */
export const OFFLINE_SYNC_JITTER_TICK_MS = 100;

/** Number of distinct reconnect slots (0..599 → 0ms .. 59.9s). */
export const OFFLINE_SYNC_JITTER_MAX_TICKS = 600;

/**
 * Deterministic reconnect delay (in 100ms ticks) shared by all staff devices for the same restaurant.
 * Devices reconnecting within the same 5-minute window get the same countdown.
 */
export function computeCentralizedReconnectDelayTicks(restaurantId: string, nowMs = Date.now()): number {
  const bucketMs = 5 * 60_000;
  const bucket = Math.floor(nowMs / bucketMs);
  let hash = 2_166_136_261;
  const key = `${restaurantId}:${bucket}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash) % OFFLINE_SYNC_JITTER_MAX_TICKS;
}
