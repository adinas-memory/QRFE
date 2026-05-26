import { TestBed } from '@angular/core/testing';
import { DeviceFeedbackService } from './device-feedback.service';
import { ClientInstanceService } from './client-instance.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { PlatformStorageService } from '../../platform/platform-storage.service';

describe('DeviceFeedbackService', () => {
  let service: DeviceFeedbackService;
  let localId: string;
  let vibrateSpy: jasmine.Spy;

  beforeEach(() => {
    localId = 'test-client-instance-id';
    vibrateSpy = jasmine.createSpy('vibrate');

    TestBed.configureTestingModule({
      providers: [
        DeviceFeedbackService,
        {
          provide: ClientInstanceService,
          useValue: { getId: () => localId, isAvailable: () => true },
        },
        {
          provide: RuntimePlatformService,
          useValue: {
            capabilities: { hapticsBackend: 'vibrate' },
          },
        },
        {
          provide: PlatformStorageService,
          useValue: {
            getHapticsEnabled: () => Promise.resolve(true),
            setHapticsEnabled: () => Promise.resolve(),
          },
        },
      ],
    });

    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrateSpy,
    });

    service = TestBed.inject(DeviceFeedbackService);
  });

  it('vibrates when client instance id matches', () => {
    service.notifyPickupReady('kitchen', {
      tableId: 'table-1',
      clientInstanceId: localId,
    });
    expect(vibrateSpy).toHaveBeenCalledWith(500);
  });

  it('does not vibrate when client instance id differs', () => {
    service.notifyPickupReady('bar', {
      tableId: 'table-1',
      clientInstanceId: 'other-device',
    });
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('does not vibrate when haptics disabled', () => {
    service.setHapticsEnabled(false);
    service.notifyPickupReady('kitchen', {
      tableId: 'table-1',
      clientInstanceId: localId,
    });
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it('debounces repeat pickup for same table', () => {
    service.notifyPickupReady('kitchen', { tableId: 'table-1', clientInstanceId: localId });
    service.notifyPickupReady('kitchen', { tableId: 'table-1', clientInstanceId: localId });
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
  });
});
