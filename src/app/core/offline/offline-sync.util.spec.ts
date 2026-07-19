import {
  computeCentralizedReconnectDelayTicks,
  OFFLINE_SYNC_JITTER_MAX_TICKS,
} from './offline-sync.util';

describe('computeCentralizedReconnectDelayTicks', () => {
  it('is stable within the same 5-minute bucket', () => {
    const now = 1_700_000_000_000;
    const a = computeCentralizedReconnectDelayTicks('rest-1', now);
    const b = computeCentralizedReconnectDelayTicks('rest-1', now + 60_000);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(OFFLINE_SYNC_JITTER_MAX_TICKS);
  });

  it('can differ across restaurants in the same bucket', () => {
    const now = 1_700_000_000_000;
    const a = computeCentralizedReconnectDelayTicks('rest-1', now);
    const b = computeCentralizedReconnectDelayTicks('rest-2', now);
    expect(a).not.toBe(b);
  });
});
