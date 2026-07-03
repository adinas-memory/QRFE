/** Spread offline sync after reconnect to reduce thundering herd (seconds, inclusive). */
export const OFFLINE_SYNC_JITTER_MAX_SECONDS = 60;

/**
 * Deterministic reconnect delay shared by all staff devices for the same restaurant.
 * Devices reconnecting within the same 5-minute window get the same countdown.
 */
export function computeCentralizedReconnectDelaySeconds(restaurantId: string, nowMs = Date.now()): number {
  const bucketMs = 5 * 60_000;
  const bucket = Math.floor(nowMs / bucketMs);
  let hash = 2_166_136_261;
  const key = `${restaurantId}:${bucket}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash) % (OFFLINE_SYNC_JITTER_MAX_SECONDS + 1);
}
