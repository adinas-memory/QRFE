import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SseConnectivityService } from './sse-connectivity.service';
import { OnlineStateService } from './online-state-service';

describe('SseConnectivityService', () => {
  let service: SseConnectivityService;
  let onlineState: jasmine.SpyObj<OnlineStateService>;

  beforeEach(() => {
    onlineState = jasmine.createSpyObj('OnlineStateService', [
      'setOnlineFromConnectivitySource',
      'setOfflineFromConnectivitySource',
      'notifyConnectivityPulse',
      'confirmConnectivity',
      'isOnline',
    ]);
    Object.defineProperty(onlineState, 'isOnline', { get: () => true, configurable: true });

    TestBed.configureTestingModule({
      providers: [
        SseConnectivityService,
        { provide: OnlineStateService, useValue: onlineState },
      ],
    });

    service = TestBed.inject(SseConnectivityService);
  });

  it('reportStreamOpened marks online and emits pulse', () => {
    service.reportStreamOpened();
    expect(onlineState.setOnlineFromConnectivitySource).toHaveBeenCalled();
    expect(onlineState.notifyConnectivityPulse).toHaveBeenCalled();
  });

  it('reportStreamError schedules offline for non-auth errors', fakeAsync(() => {
    service.reportStreamClosed();
    service.reportStreamError(false);
    tick(2000);
    expect(onlineState.setOfflineFromConnectivitySource).toHaveBeenCalled();
  }));

  it('reportStreamError ignores auth 401', fakeAsync(() => {
    service.reportStreamOpened();
    service.reportStreamError(true);
    tick(2000);
    expect(onlineState.setOfflineFromConnectivitySource).not.toHaveBeenCalled();
  }));

  it('reportStreamActivity on ConnectivityPulse keeps online', () => {
    service.reportStreamActivity('ConnectivityPulse');
    expect(onlineState.notifyConnectivityPulse).toHaveBeenCalled();
  });
});
