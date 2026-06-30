import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { OfflinePolicyService } from './offline-policy.service';
import { AuthService } from '../auth/auth.service';
import { OnlineStateService } from './online-state-service';
import { UserContextModel } from '../models/userContextModel';

describe('OfflinePolicyService', () => {
  let service: OfflinePolicyService;
  let userSubject: BehaviorSubject<UserContextModel | null>;
  let onlineSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    userSubject = new BehaviorSubject<UserContextModel | null>(null);
    onlineSubject = new BehaviorSubject<boolean>(true);

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
});
