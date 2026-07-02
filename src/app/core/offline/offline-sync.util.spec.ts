import { computeCentralizedReconnectDelaySeconds } from './offline-sync.util';

describe('computeCentralizedReconnectDelaySeconds', () => {
  it('returns the same delay for the same restaurant within a 5-minute bucket', () => {
    const now = Date.UTC(2026, 6, 2, 12, 3, 0);
    const a = computeCentralizedReconnectDelaySeconds('rest-1', now);
    const b = computeCentralizedReconnectDelaySeconds('rest-1', now + 60_000);
    expect(a).toBe(b);
  });

  it('returns different delays for different restaurants in the same bucket', () => {
    const now = Date.UTC(2026, 6, 2, 12, 3, 0);
    const a = computeCentralizedReconnectDelaySeconds('rest-1', now);
    const b = computeCentralizedReconnectDelaySeconds('rest-2', now);
    expect(a).not.toBe(b);
  });
});
