import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { SseConnectivityService } from './sse-connectivity.service';
import { OnlineStateService } from './online-state-service';
import { Subject } from 'rxjs';

describe('SseConnectivityService', () => {
  let service: SseConnectivityService;
  let onlineState: jasmine.SpyObj<OnlineStateService>;

  beforeEach(() => {
    const pingOk$ = new Subject<void>();
    onlineState = jasmine.createSpyObj('OnlineStateService', [
      'setOnlineFromConnectivitySource',
      'setOfflineFromConnectivitySource',
      'notifyConnectivityPulse',
      'confirmConnectivity',
    ]);
    Object.defineProperty(onlineState, 'isOnline', { get: () => true, configurable: true });
    Object.defineProperty(onlineState, 'pingOk$', { value: pingOk$.asObservable() });

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
    tick(500);
    expect(onlineState.setOfflineFromConnectivitySource).toHaveBeenCalled();
  }));

  it('reportStreamError ignores auth 401', fakeAsync(() => {
    service.reportStreamOpened();
    service.reportStreamError(true);
    tick(2000);
    expect(onlineState.setOfflineFromConnectivitySource).not.toHaveBeenCalled();
  }));

  it('reportStreamActivity on ConnectivityPulse keeps online', () => {
    service.reportStreamOpened();
    service.reportStreamActivity('ConnectivityPulse');
    expect(onlineState.notifyConnectivityPulse).toHaveBeenCalled();
  });

  it('reportPingFailed marks offline immediately', () => {
    service.reportStreamOpened();
    service.reportPingFailed('ping-lite-error');
    expect(onlineState.setOfflineFromConnectivitySource).toHaveBeenCalledWith('ping-lite-error');
  });

  it('reportPingSuccess ignores ok when SSE activity is stale', fakeAsync(() => {
    service.reportStreamOpened();
    tick(23_000);
    onlineState.setOnlineFromConnectivitySource.calls.reset();
    service.reportPingSuccess();
    expect(onlineState.setOnlineFromConnectivitySource).not.toHaveBeenCalled();
  }));

  it('reportPingSuccess marks online when stream is not open', () => {
    service.reportPingSuccess();
    expect(onlineState.setOnlineFromConnectivitySource).toHaveBeenCalled();
  });
});
