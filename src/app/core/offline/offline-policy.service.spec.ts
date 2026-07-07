import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { OfflinePolicyService } from './offline-policy.service';
import { AuthService } from '../auth/auth.service';
import { OnlineStateService } from './online-state-service';
import { OfflineSyncLockService } from './offline-sync-lock.service';
import { UserContextModel } from '../models/userContextModel';

describe('OfflinePolicyService', () => {
  let service: OfflinePolicyService;
  let userSubject: BehaviorSubject<UserContextModel | null>;
  let onlineSubject: BehaviorSubject<boolean>;
  let restaurantSyncLockedSubject: BehaviorSubject<boolean>;
  let secondaryAwaitingSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    userSubject = new BehaviorSubject<UserContextModel | null>(null);
    onlineSubject = new BehaviorSubject<boolean>(true);
    restaurantSyncLockedSubject = new BehaviorSubject<boolean>(false);
    secondaryAwaitingSubject = new BehaviorSubject<boolean>(false);

    TestBed.configureTestingModule({
      providers: [
        OfflinePolicyService,
        {
          provide: AuthService,
          useValue: { user$: userSubject.asObservable() },
        },
        {
          provide: OnlineStateService,
          useValue: {
            isOnline: true,
            online$: onlineSubject.asObservable(),
          },
        },
        {
          provide: OfflineSyncLockService,
          useValue: {
            restaurantSyncLocked$: restaurantSyncLockedSubject.asObservable(),
            secondaryAwaitingPrimaryReconnect$: secondaryAwaitingSubject.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(OfflinePolicyService);
  });

  it('canUseFullOffline is false when online even if primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryDevice: true,
    });
    onlineSubject.next(true);
    expect(service.canUseFullOffline()).toBeFalse();
  });

  it('canUseFullOffline is true when offline and primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryDevice: true,
    });
    onlineSubject.next(false);
    expect(service.canUseFullOffline()).toBeTrue();
  });

  it('canUseFullOffline is false when offline but not primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryDevice: false,
    });
    onlineSubject.next(false);
    expect(service.canUseFullOffline()).toBeFalse();
  });

  it('shouldShowBindDeviceCta when designee online and not primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryStaffDesignee: true,
      isOfflinePrimaryDevice: false,
    });
    onlineSubject.next(true);
    expect(service.shouldShowBindDeviceCta()).toBeTrue();
  });

  it('shouldShowOfflinePrimaryDeviceBanner when designee on registered device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryStaffDesignee: true,
      isOfflinePrimaryDevice: true,
    });
    expect(service.shouldShowOfflinePrimaryDeviceBanner()).toBeTrue();
    expect(service.shouldShowBindDeviceCta()).toBeFalse();
  });

  it('shouldFreezeWhenOffline for semi-offline designee not on primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryStaffDesignee: true,
      isOfflinePrimaryDevice: false,
    });
    onlineSubject.next(false);
    expect(service.shouldFreezeWhenOffline()).toBeTrue();
    expect(service.canProcessOfflineQueue()).toBeFalse();
  });

  it('canProcessOfflineQueue when online on any device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryDevice: false,
    });
    onlineSubject.next(true);
    expect(service.canProcessOfflineQueue()).toBeTrue();

    onlineSubject.next(false);
    expect(service.canProcessOfflineQueue()).toBeFalse();
  });

  it('canProcessOfflineQueue when online on primary device', () => {
    userSubject.next({
      id: 'u1',
      role: 'staff',
      isOfflinePrimaryDevice: true,
    });
    onlineSubject.next(true);
    expect(service.canProcessOfflineQueue()).toBeTrue();
    onlineSubject.next(false);
    expect(service.canProcessOfflineQueue()).toBeFalse();
  });

  describe('shouldRunHeavyOfflineReconnectSync', () => {
    it('returns false for non-primary regardless of reconnect or pending queue', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: false,
      });
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: true, pendingQueueCount: 5, hasAnyOpenOrdersLocal: true })).toBeFalse();
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: false, pendingQueueCount: 5, hasAnyOpenOrdersLocal: true })).toBeFalse();
    });

    it('returns false for primary on reconnect when no pending queue and no open orders', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: true,
      });
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: true, pendingQueueCount: 0, hasAnyOpenOrdersLocal: false })).toBeFalse();
    });

    it('returns true for primary with pending queue even without reconnect', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: true,
      });
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: false, pendingQueueCount: 2, hasAnyOpenOrdersLocal: false })).toBeTrue();
    });

    it('returns false for primary with no reconnect and empty queue', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: true,
      });
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: false, pendingQueueCount: 0, hasAnyOpenOrdersLocal: false })).toBeFalse();
    });

    it('returns true for primary when open orders exist locally even with empty queue', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: true,
      });
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: true, pendingQueueCount: 0, hasAnyOpenOrdersLocal: true })).toBeTrue();
      expect(service.shouldRunHeavyOfflineReconnectSync({ isReconnect: false, pendingQueueCount: 0, hasAnyOpenOrdersLocal: true })).toBeTrue();
    });
  });

  describe('shouldFreezeForRestaurantSync', () => {
    it('freezes non-primary when restaurant sync lock is active', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: false,
      });
      restaurantSyncLockedSubject.next(true);
      expect(service.shouldFreezeForRestaurantSync()).toBeTrue();
    });

    it('does not freeze primary device holding the lock', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: true,
      });
      restaurantSyncLockedSubject.next(true);
      expect(service.shouldFreezeForRestaurantSync()).toBeFalse();
    });

    it('freezes non-primary while awaiting primary reconnect sync', () => {
      userSubject.next({
        id: 'u1',
        role: 'staff',
        isOfflinePrimaryDevice: false,
      });
      secondaryAwaitingSubject.next(true);
      expect(service.shouldFreezeForRestaurantSync()).toBeTrue();
    });
  });
});
