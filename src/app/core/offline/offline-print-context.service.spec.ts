import { TestBed } from '@angular/core/testing';
import { OfflinePrintContextService } from './offline-print-context.service';
import { PlatformStorageService } from '../platform/platform-storage.service';

describe('OfflinePrintContextService', () => {
  let service: OfflinePrintContextService;
  let storage: jasmine.SpyObj<PlatformStorageService>;

  beforeEach(() => {
    storage = jasmine.createSpyObj<PlatformStorageService>('PlatformStorageService', ['getString', 'setString']);
    storage.getString.and.resolveTo(null);
    storage.setString.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        OfflinePrintContextService,
        { provide: PlatformStorageService, useValue: storage },
      ],
    });
    service = TestBed.inject(OfflinePrintContextService);
  });

  it('isReadyForOfflinePrint is false until config applied', () => {
    expect(service.isReadyForOfflinePrint()).toBeFalse();
  });

  it('applyFromSyncSnapshot persists and enables offline print', async () => {
    await service.applyFromSyncSnapshot(
      {
        defaultBillPrinterId: 'main-printer',
        agentLocalBaseUrl: 'http://192.168.1.50:9247',
        localPrintAuthToken: 'abc123',
      },
      'restaurant-1',
    );

    expect(service.isReadyForOfflinePrint()).toBeTrue();
    expect(service.getDefaultBillPrinterId()).toBe('main-printer');
    expect(storage.setString).toHaveBeenCalled();
  });
});
