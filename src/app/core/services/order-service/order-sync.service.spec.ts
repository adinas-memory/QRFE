import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { OrderSyncService } from './order-sync.service';
import { AuthService } from '../../auth/auth.service';
import { OfflineQueueProcessor } from '../../offline/offline-queue-processor.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';
import { Observable, of } from 'rxjs';

describe('OrderSyncService', () => {
  let service: OrderSyncService;
  let auth: jasmine.SpyObj<AuthService>;
  let onlineState: {
    isOnline: boolean;
    setOffline: jasmine.Spy;
    setOnline: jasmine.Spy;
    online$: Observable<boolean>;
  };

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['refreshUserContext', 'clearUser', 'isAuthenticated']);
    auth.isAuthenticated.and.returnValue(true);
    auth.refreshUserContext.and.returnValue(of(null));

    const queueSpy = jasmine.createSpyObj('OfflineQueueProcessor', ['processAction', 'processQueue']);
    const dbSpy = jasmine.createSpyObj('OfflineDbService', [
      'getPendingActions',
      'markActionDone',
      'setOffline',
      'applySyncSnapshot',
    ]);

    onlineState = {
      isOnline: true,
      setOffline: jasmine.createSpy('setOffline'),
      setOnline: jasmine.createSpy('setOnline'),
      online$: of(true),
    };

    TestBed.configureTestingModule({
      providers: [
        OrderSyncService,
        { provide: AuthService, useValue: auth },
        { provide: OfflineQueueProcessor, useValue: queueSpy },
        { provide: OfflineDbService, useValue: dbSpy },
        { provide: OnlineStateService, useValue: onlineState },
      ],
    });

    service = TestBed.inject(OrderSyncService);
    spyOn(service, 'close').and.stub();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('handleSseError when backend is down', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    it('does not call refreshUserContext when already offline', () => {
      onlineState.isOnline = false;

      (service as any).handleSseError('restaurant-1', new Error('SSE subscribe failed: HTTP 504'));

      expect(auth.refreshUserContext).not.toHaveBeenCalled();
      expect(auth.clearUser).not.toHaveBeenCalled();
    });

    it('schedules reconnect without clearing session when offline', fakeAsync(() => {
      onlineState.isOnline = false;
      spyOn(service as any, 'openConnection').and.stub();

      (service as any).handleSseError('restaurant-1', new Error('network'));
      tick(1000);

      expect(auth.refreshUserContext).not.toHaveBeenCalled();
      expect(auth.clearUser).not.toHaveBeenCalled();
    }));

    it('does not clear user after max reconnect attempts while offline', () => {
      onlineState.isOnline = false;
      (service as any).reconnectAttempts = 8;
      (service as any).maxReconnectAttempts = 8;

      (service as any).scheduleSseReconnect('restaurant-1');

      expect(auth.clearUser).not.toHaveBeenCalled();
      expect(service.close).toHaveBeenCalled();
    });

    it('on transient refresh failure while authenticated, schedules reconnect instead of logout', fakeAsync(() => {
      onlineState.isOnline = true;
      auth.refreshUserContext.and.returnValue(of(null));
      auth.isAuthenticated.and.returnValue(true);
      spyOn(service as any, 'scheduleSseReconnect').and.callThrough();

      (service as any).handleSseError('restaurant-1', new Error('SSE error'));
      tick();

      expect(auth.refreshUserContext).toHaveBeenCalled();
      expect(auth.clearUser).not.toHaveBeenCalled();
      expect((service as any).scheduleSseReconnect).toHaveBeenCalledWith('restaurant-1');
    }));
  });
});
