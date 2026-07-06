import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { NetworkMonitorService } from './network-monitor.service';
import { AuthService } from '../auth/auth.service';
import { SseConnectivityService } from '../offline/sse-connectivity.service';
import { OrderSyncService } from '../services/order-service/order-sync.service';

describe('NetworkMonitorService', () => {
  let service: NetworkMonitorService;
  let auth: jasmine.SpyObj<AuthService>;
  let nativePlatform = true;

  beforeEach(() => {
    nativePlatform = true;
    spyOn(Capacitor, 'isNativePlatform').and.callFake(() => nativePlatform);

    auth = jasmine.createSpyObj('AuthService', ['isAuthenticated']);

    TestBed.configureTestingModule({
      providers: [
        NetworkMonitorService,
        { provide: AuthService, useValue: auth },
        {
          provide: SseConnectivityService,
          useValue: jasmine.createSpyObj('SseConnectivityService', [
            'reportNativeNetworkAvailable',
            'reportNativeNetworkLost',
          ]),
        },
        {
          provide: OrderSyncService,
          useValue: jasmine.createSpyObj('OrderSyncService', ['flushPendingSseConnection']),
        },
      ],
    });

    service = TestBed.inject(NetworkMonitorService);
  });

  it('syncWithAuthState starts monitor when authenticated on native', async () => {
    const startSpy = spyOn(service, 'start').and.resolveTo();
    auth.isAuthenticated.and.returnValue(true);
    await service.syncWithAuthState();
    expect(startSpy).toHaveBeenCalled();
  });

  it('syncWithAuthState stops monitor when logged out', async () => {
    const stopSpy = spyOn(service, 'stop').and.resolveTo();
    auth.isAuthenticated.and.returnValue(false);
    await service.syncWithAuthState();
    expect(stopSpy).toHaveBeenCalled();
  });

  it('syncWithAuthState is no-op on web', async () => {
    const startSpy = spyOn(service, 'start').and.resolveTo();
    nativePlatform = false;
    auth.isAuthenticated.and.returnValue(true);
    await service.syncWithAuthState();
    expect(startSpy).not.toHaveBeenCalled();
  });
});
