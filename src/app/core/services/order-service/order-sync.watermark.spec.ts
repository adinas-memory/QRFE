import { shouldDropSseByWatermark } from '../../../testing/sse-sync-test-harness';

/**
 * Watermark gate contract — documents baseline (<=) vs current (<) behaviour.
 * Regressions here cause silent SSE drops on add/qty paths.
 */
describe('OrderSync watermark gate (sync regression)', () => {
  const watermark = 100;

  it('passes OrderUpdated at watermark boundary (seq === watermark)', () => {
    expect(shouldDropSseByWatermark(watermark, watermark)).toBeFalse();
  });

  it('drops events strictly below watermark', () => {
    expect(shouldDropSseByWatermark(99, watermark)).toBeTrue();
  });

  it('passes events above watermark', () => {
    expect(shouldDropSseByWatermark(101, watermark)).toBeFalse();
  });

  it('always passes sequence 0 (NewOrderPublicEvent)', () => {
    expect(shouldDropSseByWatermark(0, watermark)).toBeFalse();
  });

  it('always passes undefined sequence', () => {
    expect(shouldDropSseByWatermark(undefined, watermark)).toBeFalse();
  });

  /** Baseline 5d02e76 used `<=` — this documents the breaking change if reverted wrong. */
  it('baseline used <= which dropped seq equal to watermark (regression note)', () => {
    const baselineWouldDrop = (seq: number, wm: number) => !!(seq && seq <= wm);
    expect(baselineWouldDrop(watermark, watermark)).toBeTrue();
    expect(shouldDropSseByWatermark(watermark, watermark)).toBeFalse();
  });
});
