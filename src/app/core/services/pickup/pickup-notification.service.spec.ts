import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { PickupNotificationService } from './pickup-notification.service';
import { OrderSyncService } from '../order-service/order-sync.service';
import { PushRegistrationService } from '../push/push-registration.service';
import { DeviceFeedbackService } from '../device/device-feedback.service';

describe('PickupNotificationService', () => {
  let service: PickupNotificationService;
  let pushRegistration: jasmine.SpyObj<PushRegistrationService>;
  let deviceFeedback: jasmine.SpyObj<DeviceFeedbackService>;
  const sseEvents$ = new Subject<unknown>();

  beforeEach(() => {
    pushRegistration = jasmine.createSpyObj('PushRegistrationService', ['deliverPickupAlert']);
    pushRegistration.deliverPickupAlert.and.returnValue(Promise.resolve());
    deviceFeedback = jasmine.createSpyObj('DeviceFeedbackService', ['notifyPickupReady']);

    TestBed.configureTestingModule({
      providers: [
        PickupNotificationService,
        { provide: PushRegistrationService, useValue: pushRegistration },
        { provide: DeviceFeedbackService, useValue: deviceFeedback },
        {
          provide: OrderSyncService,
          useValue: { events$: sseEvents$.asObservable() },
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

  it('handlePickupSse triggers haptics and PWA alert delivery', async () => {
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

  it('initGlobalAlerts handles kitchen SSE events once per sequence', async () => {
    service.initGlobalAlerts();
    const payload = {
      EventType: 'KitchenWaiterCall',
      Data: { TableId: 't2', TableName: 'Bar 2', ClientInstanceId: 'dev-2' },
      Sequence: 42,
    };
    sseEvents$.next(payload);
    sseEvents$.next(payload);
    expect(deviceFeedback.notifyPickupReady).toHaveBeenCalledTimes(1);
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalledTimes(1);
  });
});
