import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  OFFLINE_RECONNECT_DELAY_RESOLVER,
  OfflineSyncSchedulerService,
} from './offline-sync-scheduler.service';
import { OfflineQueueProcessor } from './offline-queue-processor.service';
import { OfflineDbService } from './offline-db';
import { OnlineStateService } from './online-state-service';
import { AuthService } from '../auth/auth.service';
import { OrderSyncService } from '../services/order-service/order-sync.service';

describe('OfflineSyncSchedulerService', () => {
  let service: OfflineSyncSchedulerService;
  let online$: Subject<boolean>;
  let pingOk$: Subject<void>;
  let onlineState: {
    isOnline: boolean;
    online$: Subject<boolean>['asObservable'] extends () => infer R ? R : never;
    pingOk$: Subject<void>['asObservable'] extends () => infer R ? R : never;
  };
  let queueProcessor: jasmine.SpyObj<OfflineQueueProcessor>;
  let offlineDb: jasmine.SpyObj<OfflineDbService>;
  let auth: jasmine.SpyObj<AuthService>;
  let orderSync: jasmine.SpyObj<OrderSyncService>;
  const delayConfig = { seconds: 54 };

  beforeEach(() => {
    delayConfig.seconds = 54;
    online$ = new Subject<boolean>();
    pingOk$ = new Subject<void>();
    onlineState = { isOnline: true, online$: online$.asObservable(), pingOk$: pingOk$.asObservable() };

    queueProcessor = jasmine.createSpyObj('OfflineQueueProcessor', [
      'processQueue',
      'recoverOrphanedCartsPublic',
    ]);
    queueProcessor.processQueue.and.returnValue(Promise.resolve());
    queueProcessor.recoverOrphanedCartsPublic.and.returnValue(Promise.resolve());

    offlineDb = jasmine.createSpyObj('OfflineDbService', ['getPendingActionsForRestaurant']);
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([{ id: 'a1' } as never]));

    auth = jasmine.createSpyObj('AuthService', ['getUserSnapshot']);
    auth.getUserSnapshot.and.returnValue({ restaurantId: 'rest-1', isOfflinePrimaryDevice: true } as never);
    Object.defineProperty(auth, 'loggedIn$', { value: new Subject<void>().asObservable() });

    orderSync = jasmine.createSpyObj('OrderSyncService', ['reconcileAfterOfflineSync']);
    orderSync.reconcileAfterOfflineSync.and.returnValue(Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        OfflineSyncSchedulerService,
        { provide: OnlineStateService, useValue: onlineState },
        { provide: OfflineDbService, useValue: offlineDb },
        { provide: AuthService, useValue: auth },
        { provide: OfflineQueueProcessor, useValue: queueProcessor },
        { provide: OrderSyncService, useValue: orderSync },
        { provide: OFFLINE_RECONNECT_DELAY_RESOLVER, useFactory: () => () => delayConfig.seconds },
      ],
    });

    service = TestBed.inject(OfflineSyncSchedulerService);
  });

  it('starts centralized countdown on reconnect when pending actions exist', fakeAsync(() => {
    const values: Array<number | null> = [];
    service.syncCountdownSeconds$.subscribe(v => values.push(v));

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(values.some(v => v !== null && v > 0)).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(54_000);
    expect(queueProcessor.processQueue).toHaveBeenCalledWith({ force: true, emitDrainedOnComplete: true });
    expect(values[values.length - 1]).toBeNull();
  }));

  it('does not schedule when queue is empty and not a reconnect', fakeAsync(() => {
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));
    const countdown = new BehaviorSubject<number | null>(-1);
    service.syncCountdownSeconds$.subscribe(v => countdown.next(v));

    void service.onSessionRestored();
    tick();

    expect(countdown.value).toBeNull();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();
    expect(orderSync.reconcileAfterOfflineSync).not.toHaveBeenCalled();
  }));

  it('cancels countdown when going offline', fakeAsync(() => {
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
    void service.runWhenAllowed();
    tick();

    expect(service.isCountdownActive()).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(54_000);
    expect(queueProcessor.processQueue).toHaveBeenCalledTimes(1);
  }));

  it('blocks processQueue until countdown completes', fakeAsync(() => {
    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(service.isSyncBlocked()).toBeTrue();

    tick(54_000);
    expect(service.isSyncBlocked()).toBeFalse();
    expect(queueProcessor.processQueue).toHaveBeenCalledWith({ force: true, emitDrainedOnComplete: true });
  }));

  it('reconciles on reconnect for non-primary devices without local pending queue', fakeAsync(() => {
    delayConfig.seconds = 0;
    auth.getUserSnapshot.and.returnValue({
      restaurantId: 'rest-1',
      isOfflinePrimaryDevice: false,
    } as never);
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(queueProcessor.processQueue).not.toHaveBeenCalled();
    expect(orderSync.reconcileAfterOfflineSync).toHaveBeenCalled();
  }));

  it('shows centralized countdown on reconnect even without local pending queue', fakeAsync(() => {
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(service.isCountdownActive()).toBeTrue();
    expect(queueProcessor.processQueue).not.toHaveBeenCalled();

    tick(54_000);
    expect(orderSync.reconcileAfterOfflineSync).toHaveBeenCalled();
  }));

  it('clears sync UI after reconnect when reconcile does not call /api/sync', fakeAsync(() => {
    delayConfig.seconds = 0;
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));
    orderSync.reconcileAfterOfflineSync.and.returnValue(Promise.resolve(false));

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(orderSync.reconcileAfterOfflineSync).toHaveBeenCalled();
    expect(service.isSyncBlocked()).toBeFalse();
    expect(service.isCountdownActive()).toBeFalse();
  }));

  it('does not dismiss countdown early on ping-lite while countdown is active', fakeAsync(() => {
    offlineDb.getPendingActionsForRestaurant.and.returnValue(Promise.resolve([]));

    online$.next(false);
    onlineState.isOnline = true;
    online$.next(true);
    tick();

    expect(service.isCountdownActive()).toBeTrue();
    pingOk$.next();
    tick();
    expect(service.isCountdownActive()).toBeTrue();
  }));
});
