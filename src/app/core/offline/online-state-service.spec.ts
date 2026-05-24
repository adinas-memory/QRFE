import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { OnlineStateService } from './online-state-service';

describe('OnlineStateService', () => {
  let service: OnlineStateService;

  beforeEach(() => {
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
});
