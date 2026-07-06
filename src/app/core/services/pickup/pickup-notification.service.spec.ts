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
  let pulseOrder: string[];

  beforeEach(() => {
    pulseOrder = [];
    pushRegistration = jasmine.createSpyObj('PushRegistrationService', [
      'deliverPickupAlert',
      'deliverGuestWaiterAlert',
    ]);
    pushRegistration.deliverPickupAlert.and.callFake(async () => {
      pulseOrder.push('deliverPickupAlert');
    });
    pushRegistration.deliverGuestWaiterAlert.and.returnValue(Promise.resolve());
    deviceFeedback = jasmine.createSpyObj('DeviceFeedbackService', [
      'pulsePickup',
      'notifyGuestWaiterCall',
    ]);
    deviceFeedback.pulsePickup.and.callFake(async () => {
      pulseOrder.push('pulsePickup');
      return true;
    });

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

  it('handlePickupSse vibrates before PWA alert delivery for kitchen', async () => {
    const result = await service.handlePickupSse('kitchen', {
      TableId: 'table-a',
      TableName: 'Masa 1',
      ClientInstanceId: 'device-x',
    });
    expect(result.tableId).toBe('table-a');
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledWith('kitchen', 'table-a', 'sse');
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        eventType: 'KitchenWaiterCall',
        tableId: 'table-a',
        tableName: 'Masa 1',
        source: 'sse',
      }),
    );
    expect(pulseOrder).toEqual(['pulsePickup', 'deliverPickupAlert']);
  });

  it('handlePickupSse is symmetric for bar', async () => {
    await service.handlePickupSse('bar', {
      TableId: 'table-b',
      TableName: 'Bar 5',
      ClientInstanceId: 'device-y',
    });
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledWith('bar', 'table-b', 'sse');
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        eventType: 'BarWaiterCall',
        tableId: 'table-b',
        tableName: 'Bar 5',
        source: 'sse',
      }),
    );
  });

  it('handleGuestWaiterSse vibrates all devices and delivers guest alert', () => {
    const result = service.handleGuestWaiterSse({
      TableId: 'table-guest',
      TableName: 'Terasa 1',
    });
    expect(result.tableId).toBe('table-guest');
    expect(deviceFeedback.notifyGuestWaiterCall).toHaveBeenCalledWith('table-guest');
    expect(pushRegistration.deliverGuestWaiterAlert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        tableId: 'table-guest',
        tableName: 'Terasa 1',
        source: 'sse',
      }),
    );
  });

  it('initGlobalAlerts handles WaiterCall SSE events', () => {
    service.initGlobalAlerts();
    sseEvents$.next({
      EventType: 'WaiterCall',
      Data: { TableId: 't-guest', TableName: 'Masa 2' },
      Sequence: 99,
    });
    expect(deviceFeedback.notifyGuestWaiterCall).toHaveBeenCalledWith('t-guest');
    expect(pushRegistration.deliverGuestWaiterAlert).toHaveBeenCalledTimes(1);
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
    await Promise.resolve();
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledTimes(1);
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledWith('kitchen', 't2', 'sse');
    expect(pushRegistration.deliverPickupAlert).toHaveBeenCalledTimes(1);
  });

  it('initGlobalAlerts handles BarWaiterCall SSE events once per sequence', async () => {
    service.initGlobalAlerts();
    const payload = {
      EventType: 'BarWaiterCall',
      Data: { TableId: 't3', TableName: 'Masa 3' },
      Sequence: 43,
    };
    sseEvents$.next(payload);
    sseEvents$.next(payload);
    await Promise.resolve();
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledTimes(1);
    expect(deviceFeedback.pulsePickup).toHaveBeenCalledWith('bar', 't3', 'sse');
  });
});
