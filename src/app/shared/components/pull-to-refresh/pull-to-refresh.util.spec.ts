import {
  computeIndicatorHeight,
  dampPullDistance,
  isPullGestureAllowed,
  PTR_MAX_PULL_PX,
  PTR_TRIGGER_THRESHOLD_PX,
  shouldTriggerRefresh,
} from './pull-to-refresh.util';

describe('pull-to-refresh.util', () => {
  describe('isPullGestureAllowed', () => {
    it('allows pull at scroll top with no overlays', () => {
      expect(
        isPullGestureAllowed({
          scrollY: 0,
          modalOpen: false,
          offcanvasOpen: false,
          refreshing: false,
        }),
      ).toBeTrue();
    });

    it('blocks pull when scrolled', () => {
      expect(
        isPullGestureAllowed({
          scrollY: 12,
          modalOpen: false,
          offcanvasOpen: false,
          refreshing: false,
        }),
      ).toBeFalse();
    });

    it('blocks pull when modal or offcanvas is open', () => {
      expect(
        isPullGestureAllowed({
          scrollY: 0,
          modalOpen: true,
          offcanvasOpen: false,
          refreshing: false,
        }),
      ).toBeFalse();
      expect(
        isPullGestureAllowed({
          scrollY: 0,
          modalOpen: false,
          offcanvasOpen: true,
          refreshing: false,
        }),
      ).toBeFalse();
    });

    it('blocks pull while refresh is in progress', () => {
      expect(
        isPullGestureAllowed({
          scrollY: 0,
          modalOpen: false,
          offcanvasOpen: false,
          refreshing: true,
        }),
      ).toBeFalse();
    });
  });

  describe('shouldTriggerRefresh', () => {
    it('triggers at threshold', () => {
      expect(shouldTriggerRefresh(PTR_TRIGGER_THRESHOLD_PX - 1)).toBeFalse();
      expect(shouldTriggerRefresh(PTR_TRIGGER_THRESHOLD_PX)).toBeTrue();
    });
  });

  describe('dampPullDistance', () => {
    it('returns zero for upward movement', () => {
      expect(dampPullDistance(-20)).toBe(0);
    });

    it('applies damping and caps at max pull', () => {
      expect(dampPullDistance(200)).toBe(PTR_MAX_PULL_PX);
      expect(dampPullDistance(80)).toBe(40);
    });
  });

  describe('computeIndicatorHeight', () => {
    it('clamps indicator height to max pull', () => {
      expect(computeIndicatorHeight(150)).toBe(PTR_MAX_PULL_PX);
      expect(computeIndicatorHeight(40)).toBe(40);
    });
  });
});
