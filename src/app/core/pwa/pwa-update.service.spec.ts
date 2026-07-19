import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { OfflineDbService } from '../offline/offline-db';
import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  let service: PwaUpdateService;
  let versionUpdates$: Subject<VersionEvent>;
  let activateUpdate: jasmine.Spy;
  let checkForUpdate: jasmine.Spy;
  let hasAnyActiveOpenOrdersLocal: jasmine.Spy;
  let getUserSnapshot: jasmine.Spy;
  let reloadSpy: jasmine.Spy;

  beforeEach(() => {
    versionUpdates$ = new Subject<VersionEvent>();
    activateUpdate = jasmine.createSpy('activateUpdate').and.resolveTo(true);
    checkForUpdate = jasmine.createSpy('checkForUpdate').and.resolveTo(false);
    hasAnyActiveOpenOrdersLocal = jasmine
      .createSpy('hasAnyActiveOpenOrdersLocal')
      .and.resolveTo(false);
    getUserSnapshot = jasmine.createSpy('getUserSnapshot').and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        PwaUpdateService,
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: versionUpdates$.asObservable(),
            checkForUpdate,
            activateUpdate,
          },
        },
        {
          provide: OfflineDbService,
          useValue: { hasAnyActiveOpenOrdersLocal },
        },
        {
          provide: AuthService,
          useValue: { getUserSnapshot },
        },
      ],
    });

    service = TestBed.inject(PwaUpdateService);
    reloadSpy = jasmine.createSpy('reload');
    service.reload = reloadSpy;
  });

  afterEach(() => {
    versionUpdates$.complete();
  });

  function emitVersionReady(): void {
    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });
  }

  it('start no-ops when SwUpdate is disabled', () => {
    const disabled = TestBed.inject(SwUpdate) as { isEnabled: boolean };
    disabled.isEnabled = false;
    service.start();
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('silently activates on VERSION_READY when no open orders', async () => {
    getUserSnapshot.and.returnValue({
      id: 'u1',
      role: 'staff',
      restaurantId: '019f0262-bc46-7efe-ba2c-06af2ee96ff4',
    });
    hasAnyActiveOpenOrdersLocal.and.resolveTo(false);

    service.start();
    emitVersionReady();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.updateAvailable()).toBeTrue();
    expect(service.modalVisible()).toBeFalse();
    expect(activateUpdate).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('defers silently when restaurant has open orders', async () => {
    getUserSnapshot.and.returnValue({
      id: 'u1',
      role: 'staff',
      restaurantId: '019f0262-bc46-7efe-ba2c-06af2ee96ff4',
    });
    hasAnyActiveOpenOrdersLocal.and.resolveTo(true);

    service.start();
    emitVersionReady();
    await Promise.resolve();
    await Promise.resolve();

    expect(hasAnyActiveOpenOrdersLocal).toHaveBeenCalledWith(
      '019f0262-bc46-7efe-ba2c-06af2ee96ff4',
    );
    expect(service.updateBlocked()).toBeTrue();
    expect(service.modalVisible()).toBeFalse();
    expect(activateUpdate).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('confirmUpdate activates and reloads when no open orders', async () => {
    getUserSnapshot.and.returnValue({
      id: 'u1',
      role: 'staff',
      restaurantId: '019f0262-bc46-7efe-ba2c-06af2ee96ff4',
    });
    hasAnyActiveOpenOrdersLocal.and.resolveTo(false);
    service.start();
    service.updateAvailable.set(true);

    await service.confirmUpdate();

    expect(activateUpdate).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
    expect(service.updateBlocked()).toBeFalse();
  });

  it('confirmUpdate allows update when there is no assigned restaurantId', async () => {
    getUserSnapshot.and.returnValue({ id: 'admin', role: 'gadmin', restaurantId: null });
    service.start();
    service.updateAvailable.set(true);

    await service.confirmUpdate();

    expect(hasAnyActiveOpenOrdersLocal).not.toHaveBeenCalled();
    expect(activateUpdate).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('dismiss keeps updateAvailable but does not show modal', () => {
    service.start();
    service.updateAvailable.set(true);
    service.modalVisible.set(true);
    service.dismiss();
    expect(service.updateAvailable()).toBeTrue();
    expect(service.modalVisible()).toBeFalse();
  });
});
