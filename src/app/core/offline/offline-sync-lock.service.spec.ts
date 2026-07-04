import { TestBed } from '@angular/core/testing';
import { OfflineSyncLockService } from './offline-sync-lock.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

describe('OfflineSyncLockService', () => {
  let service: OfflineSyncLockService;
  let httpMock: HttpTestingController;
  const apiUrl = environment.apiUrl.replace(/\/$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OfflineSyncLockService,
        {
          provide: AuthService,
          useValue: {
            getUserSnapshot: () => ({ restaurantId: 'rest-1' }),
            getUserRestaurantId: () => 'rest-1',
          },
        },
      ],
    });

    service = TestBed.inject(OfflineSyncLockService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('setRestaurantSyncLocked updates observable', () => {
    const values: boolean[] = [];
    service.restaurantSyncLocked$.subscribe(v => values.push(v));
    service.setRestaurantSyncLocked(true);
    service.setRestaurantSyncLocked(false);
    expect(values).toEqual([false, true, false]);
  });

  it('beginSync marks restaurant locked locally', async () => {
    const promise = service.beginSync();
    const req = httpMock.expectOne(r => r.url === `${apiUrl}/api/offline-sync/begin`);
    expect(req.request.method).toBe('POST');
    req.flush({ acquired: true });
    await expectAsync(promise).toBeResolvedTo(true);
    expect(service.isRestaurantSyncLocked()).toBeTrue();
  });

  it('completeSync clears local lock state', async () => {
    service.setRestaurantSyncLocked(true);
    (service as unknown as { localLockHeld: boolean }).localLockHeld = true;

    const promise = service.completeSync();
    const req = httpMock.expectOne(r => r.url === `${apiUrl}/api/offline-sync/complete`);
    req.flush({ released: true });
    await expectAsync(promise).toBeResolvedTo(true);
    expect(service.isRestaurantSyncLocked()).toBeFalse();
  });
});
