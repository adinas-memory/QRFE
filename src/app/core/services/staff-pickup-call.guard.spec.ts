import { endStaffPickupCall, tryBeginStaffPickupCall } from './staff-pickup-call.guard';

describe('staff-pickup-call.guard', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('allows first call and blocks duplicate within TTL', () => {
    const rid = 'r1';
    const tid = 't1';
    expect(tryBeginStaffPickupCall('kitchen', rid, tid)).toBeTrue();
    expect(tryBeginStaffPickupCall('kitchen', rid, tid)).toBeFalse();
    endStaffPickupCall('kitchen', rid, tid);
    // sessionStorage TTL still blocks rapid re-fire after HTTP completes
    expect(tryBeginStaffPickupCall('kitchen', rid, tid)).toBeFalse();
  });

  it('allows different tables independently', () => {
    expect(tryBeginStaffPickupCall('kitchen', 'r1', 't1')).toBeTrue();
    expect(tryBeginStaffPickupCall('kitchen', 'r1', 't2')).toBeTrue();
    endStaffPickupCall('kitchen', 'r1', 't1');
    endStaffPickupCall('kitchen', 'r1', 't2');
  });

  it('allows kitchen and bar pickup on the same table independently', () => {
    expect(tryBeginStaffPickupCall('kitchen', 'r1', 't1')).toBeTrue();
    expect(tryBeginStaffPickupCall('bar', 'r1', 't1')).toBeTrue();
    endStaffPickupCall('kitchen', 'r1', 't1');
    endStaffPickupCall('bar', 'r1', 't1');
  });
});
