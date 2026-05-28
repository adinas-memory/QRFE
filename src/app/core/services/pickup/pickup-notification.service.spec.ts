import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PickupNotificationService } from './pickup-notification.service';
import { DeviceFeedbackService } from '../device/device-feedback.service';
import { OrderSyncService } from '../order-service/order-sync.service';
import { PushRegistrationService } from '../push/push-registration.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';

describe('PickupNotificationService', () => {
  let service: PickupNotificationService;
  let deviceFeedback: jasmine.SpyObj<DeviceFeedbackService>;
  let pushRegistration: jasmine.SpyObj<PushRegistrationService>;
  const sseEvents$ = new Subject<unknown>();

  beforeEach(() => {
    deviceFeedback = jasmine.createSpyObj('DeviceFeedbackService', ['notifyPickupReady']);
    pushRegistration = jasmine.createSpyObj('PushRegistrationService', ['deliverPickupAlert']);
    pushRegistration.deliverPickupAlert.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        PickupNotificationService,
        { provide: DeviceFeedbackService, useValue: deviceFeedback },
        { provide: PushRegistrationService, useValue: pushRegistration },
        {
          provide: OrderSyncService,
          useValue: { events$: sseEvents$.asObservable() },
        },
        {
          provide: RuntimePlatformService,
          useValue: { isNative: false },
        },
      ],
    });

    service = TestBed.inject(PickupNotificationService);
  });

  it('parses PascalCase and camelCase fields', () => {
    const pascal = service.parsePickupPayload({
      TableId: 't1',
      TableName: 'Terasa 3',
      ClientInstanceId: 'dev-1',
    });
    expect(pascal.tableId).toBe('t1');
    expect(pascal.tableName).toBe('Terasa 3');
    expect(pascal.clientInstanceId).toBe('dev-1');
  });

  it('handlePickupSse notifies device feedback and deliverPickupAlert', async () => {
    const result = service.handlePickupSse('kitchen', {
      TableId: 'table-a',
      TableName: 'Masa 1',
      ClientInstanceId: 'device-x',
    });
    expect(result.tableId).toBe('table-a');
    expect(deviceFeedback.notifyPickupReady).toHaveBeenCalledWith('kitchen', {
      tableId: 'table-a',
      clientInstanceId: 'device-x',
    });
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        eventType: 'KitchenWaiterCall',
        tableId: 'table-a',
        tableName: 'Masa 1',
        source: 'sse',
      }),
    );
  });

  it('initGlobalAlerts handles kitchen SSE events', async () => {
    service.initGlobalAlerts();
    sseEvents$.next({
      EventType: 'KitchenWaiterCall',
      Data: { TableId: 't2', TableName: 'Bar 2', ClientInstanceId: 'dev-2' },
    });
    expect(deviceFeedback.notifyPickupReady).toHaveBeenCalled();
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalled();
  });
});
