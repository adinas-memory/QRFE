export const PTR_TRIGGER_THRESHOLD_PX = 60;
export const PTR_MAX_PULL_PX = 100;

export interface PullToRefreshGuardState {
  scrollY: number;
  modalOpen: boolean;
  offcanvasOpen: boolean;
  refreshing: boolean;
}

export function isPullGestureAllowed(state: PullToRefreshGuardState): boolean {
  if (state.refreshing) {
    return false;
  }
  if (state.scrollY > 0) {
    return false;
  }
  if (state.modalOpen || state.offcanvasOpen) {
    return false;
  }
  return true;
}

export function shouldTriggerRefresh(
  pullDistancePx: number,
  thresholdPx = PTR_TRIGGER_THRESHOLD_PX,
): boolean {
  return pullDistancePx >= thresholdPx;
}

export function computeIndicatorHeight(
  pullDistancePx: number,
  maxPullPx = PTR_MAX_PULL_PX,
): number {
  return Math.min(Math.max(pullDistancePx, 0), maxPullPx);
}

/** Resist pull beyond max and apply slight damping for natural feel. */
export function dampPullDistance(rawDeltaPx: number, maxPullPx = PTR_MAX_PULL_PX): number {
  if (rawDeltaPx <= 0) {
    return 0;
  }
  return Math.min(rawDeltaPx * 0.5, maxPullPx);
}

export function isOverlayOpen(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return (
    document.body.classList.contains('modal-open')
    || document.querySelector('.offcanvas.show') !== null
  );
}
