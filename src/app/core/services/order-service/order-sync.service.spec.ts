import { TestBed } from '@angular/core/testing';
import { OrderSyncService } from './order-sync.service';
import { AuthService } from '../../auth/auth.service';
import { OfflineQueueProcessor } from '../../offline/offline-queue-processor.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';
import { of } from 'rxjs';

describe('OrderSyncService', () => {
  let service: OrderSyncService;

  beforeEach(() => {
    const authSpy = jasmine.createSpyObj('AuthService', ['refreshUserContext', 'clearUser', 'isAuthenticated']);
    authSpy.isAuthenticated.and.returnValue(true);
    const queueSpy = jasmine.createSpyObj('OfflineQueueProcessor', ['processAction', 'processQueue']);
    const dbSpy = jasmine.createSpyObj('OfflineDbService', ['getPendingActions', 'markActionDone', 'setOffline', 'applySyncSnapshot']);
    const onlineSpy = jasmine.createSpyObj('OnlineStateService', ['setOffline', 'setOnline'], { isOnline: true, online$: of(true) });

    TestBed.configureTestingModule({
      providers: [
        OrderSyncService,
        { provide: AuthService, useValue: authSpy },
        { provide: OfflineQueueProcessor, useValue: queueSpy },
        { provide: OfflineDbService, useValue: dbSpy },
        { provide: OnlineStateService, useValue: onlineSpy }
      ]
    });
    service = TestBed.inject(OrderSyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
