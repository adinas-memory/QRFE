import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { OnlineStateService } from './online-state-service';
import { firstValueFrom } from 'rxjs';

describe('OnlineStateService', () => {
  let service: OnlineStateService;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    fetchSpy = jasmine.createSpy('fetch').and.returnValue(
      Promise.resolve({ ok: true, status: 200 }),
    );
    spyOn(window, 'fetch').and.callFake(fetchSpy);

    TestBed.configureTestingModule({
      providers: [OnlineStateService],
    });
    service = TestBed.inject(OnlineStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.isOnline).toBe(true);
  });

  it('setOffline toggles isOnline and emits on online$', fakeAsync(() => {
    const emissions: boolean[] = [];
    service.online$.subscribe(v => emissions.push(v));

    service.setOffline();
    tick();

    expect(service.isOnline).toBe(false);
    expect(emissions).toContain(false);
  }));

  it('setOnline restores isOnline after setOffline', () => {
    service.setOffline();
    service.setOnline();
    expect(service.isOnline).toBe(true);
  });

  it('triggerResumeCheck debounces and emits resumeConnectivityOk$ after ping', fakeAsync(async () => {
    const resumePromise = firstValueFrom(service.resumeConnectivityOk$);

    service.triggerResumeCheck();
    service.triggerResumeCheck();
    tick(299);
    expect(fetchSpy).not.toHaveBeenCalled();

    tick(1);
    await resumePromise;

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.calls.mostRecent().args[0]).toContain('/api/ping-lite');
    expect(fetchSpy.calls.mostRecent().args[1]?.method).toBe('HEAD');
  }));

  it('does not emit resumeConnectivityOk$ when ping fails', fakeAsync(() => {
    fetchSpy.and.returnValue(Promise.resolve({ ok: false, status: 503 }));
    let emitted = false;
    service.resumeConnectivityOk$.subscribe(() => { emitted = true; });

    service.triggerResumeCheck();
    tick(300);

    expect(emitted).toBe(false);
  }));

  it('confirmConnectivity emits resume path even when already online', fakeAsync(async () => {
    expect(service.isOnline).toBe(true);
    const resumePromise = firstValueFrom(service.resumeConnectivityOk$);

    service.triggerResumeCheck();
    tick(300);
    await resumePromise;

    expect(service.isOnline).toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
  }));

  it('triggerResumeCheck ignores duplicate resume within cooldown', fakeAsync(() => {
    service.triggerResumeCheck();
    tick(300);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    service.triggerResumeCheck();
    tick(300);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  }));
});
