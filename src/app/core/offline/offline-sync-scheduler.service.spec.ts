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
  let onlineState: { isOnline: boolean; online$: Subject<boolean>['asObservable'] extends () => infer R ? R : never };
  let queueProcessor: jasmine.SpyObj<OfflineQueueProcessor>;
  let offlineDb: jasmine.SpyObj<OfflineDbService>;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    online$ = new Subject<boolean>();
    onlineState = { isOnline: true, online$: online$.asObservable() };

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
        { provide: OnlineStateService, useValue: onlineState },
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
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(values.some(v => v !== null && v > 0)).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(60_000);
    expect(queueProcessor.processQueue).toHaveBeenCalledWith({ force: true, emitDrainedOnComplete: true });
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
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(service.isCountdownActive()).toBeTrue();

    onlineState.isOnline = false;
    online$.next(false);
    tick();

    expect(service.isCountdownActive()).toBeFalse();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();
  }));

  it('runWhenAllowed does not drain before countdown finishes', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.9);

    void service.runWhenAllowed();
    tick();

    expect(service.isCountdownActive()).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(60_000);
    expect(queueProcessor.processQueue).toHaveBeenCalledTimes(1);
  }));

  it('blocks processQueue until countdown completes', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValue(0.5);

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(service.isSyncBlocked()).toBeTrue();

    tick(31_000);
    expect(service.isSyncBlocked()).toBeFalse();
    expect(queueProcessor.processQueue).toHaveBeenCalledWith({ force: true, emitDrainedOnComplete: true });
  }));
});
