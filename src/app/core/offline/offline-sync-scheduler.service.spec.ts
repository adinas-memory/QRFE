import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { OfflineSyncSchedulerService } from './offline-sync-scheduler.service';
import { OfflineQueueProcessor } from './offline-queue-processor.service';
import { OfflineDbService } from './offline-db';
import { OnlineStateService } from './online-state-service';
import { AuthService } from '../auth/auth.service';

describe('OfflineSyncSchedulerService', () => {
  let service: OfflineSyncSchedulerService;
  let online$: Subject<boolean>;
  let queueProcessor: jasmine.SpyObj<OfflineQueueProcessor>;
  let offlineDb: jasmine.SpyObj<OfflineDbService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    online$ = new Subject<boolean>();

    queueProcessor = jasmine.createSpyObj('OfflineQueueProcessor', [
      'processQueue',
      'recoverOrphanedCartsPublic',
    ]);
    queueProcessor.processQueue.and.returnValue(Promise.resolve());
    queueProcessor.recoverOrphanedCartsPublic.and.returnValue(Promise.resolve());

    offlineDb = jasmine.createSpyObj('OfflineDbService', ['getPendingActionsForRestaurant']);
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([{ id: 'a1' } as never]));

    auth = jasmine.createSpyObj('AuthService', ['getUserSnapshot']);
    auth.getUserSnapshot.and.returnValue({ restaurantId: 'rest-1' } as never);
    Object.defineProperty(auth, 'loggedIn$', { value: new Subject<void>().asObservable() });

    TestBed.configureTestingModule({
      providers: [
        OfflineSyncSchedulerService,
        { provide: OnlineStateService, useValue: { online$: online$.asObservable() } },
        { provide: OfflineDbService, useValue: offlineDb },
        { provide: AuthService, useValue: auth },
        { provide: OfflineQueueProcessor, useValue: queueProcessor },
      ],
    });

    service = TestBed.inject(OfflineSyncSchedulerService);
  });

  it('starts countdown on reconnect when pending actions exist', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.9);
    const values: Array<number | null> = [];
    service.syncCountdownSeconds$.subscribe(v => values.push(v));

    online$.next(false);
    online$.next(true);
    tick(500);
    tick();

    expect(values.some(v => v !== null && v > 0)).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(60_000);
    expect(queueProcessor.processQueue).toHaveBeenCalled();
    expect(values[values.length - 1]).toBeNull();
  }));

  it('does not schedule when queue is empty', fakeAsync(() => {
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));
    const countdown = new BehaviorSubject<number | null>(-1);
    service.syncCountdownSeconds$.subscribe(v => countdown.next(v));

    void service.onSessionRestored();
    tick();

    expect(countdown.value).toBeNull();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();
  }));

  it('cancels countdown when going offline', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.5);

    online$.next(false);
    online$.next(true);
    tick(500);
    tick();

    expect(service.isCountdownActive()).toBeTrue();

    online$.next(false);
    tick();

    expect(service.isCountdownActive()).toBeFalse();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();
  }));

  it('runWhenAllowed waits for countdown then drains queue', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.5);

    online$.next(false);
    online$.next(true);
    tick(500);
    tick();

    let resolved = false;
    void service.runWhenAllowed().then(() => { resolved = true; });

    tick(29_000);
    expect(resolved).toBeFalse();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(2_000);
    expect(resolved).toBeTrue();
    expect(queueProcessor.processQueue).toHaveBeenCalled();
  }));
});
