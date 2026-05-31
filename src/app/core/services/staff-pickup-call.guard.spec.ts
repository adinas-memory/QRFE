import { endStaffPickupCall, tryBeginStaffPickupCall } from './staff-pickup-call.guard';

describe('staff-pickup-call.guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows first call and blocks duplicate within TTL', () => {
    const rid = 'r1';
    const tid = 't1';
    expect(tryBeginStaffPickupCall(rid, tid)).toBeTrue();
    expect(tryBeginStaffPickupCall(rid, tid)).toBeFalse();
    endStaffPickupCall(rid, tid);
    // sessionStorage TTL still blocks rapid re-fire after HTTP completes
    expect(tryBeginStaffPickupCall(rid, tid)).toBeFalse();
  });

  it('allows different tables independently', () => {
    expect(tryBeginStaffPickupCall('r1', 't1')).toBeTrue();
    expect(tryBeginStaffPickupCall('r1', 't2')).toBeTrue();
    endStaffPickupCall('r1', 't1');
    endStaffPickupCall('r1', 't2');
  });
});
