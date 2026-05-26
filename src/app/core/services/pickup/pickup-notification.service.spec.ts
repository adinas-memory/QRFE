import { TestBed } from '@angular/core/testing';
import { PickupNotificationService } from './pickup-notification.service';
import { DeviceFeedbackService } from '../device/device-feedback.service';

describe('PickupNotificationService', () => {
  let service: PickupNotificationService;
  let deviceFeedback: jasmine.SpyObj<DeviceFeedbackService>;

  beforeEach(() => {
    deviceFeedback = jasmine.createSpyObj('DeviceFeedbackService', ['notifyPickupReady']);

    TestBed.configureTestingModule({
      providers: [
        PickupNotificationService,
        { provide: DeviceFeedbackService, useValue: deviceFeedback },
      ],
    });

    service = TestBed.inject(PickupNotificationService);
  });

  it('parses PascalCase and camelCase fields', () => {
    const pascal = service.parsePickupPayload({
      TableId: 't1',
      ClientInstanceId: 'dev-1',
    });
    expect(pascal.tableId).toBe('t1');
    expect(pascal.clientInstanceId).toBe('dev-1');

    const camel = service.parsePickupPayload({
      tableId: 't2',
      clientInstanceId: 'dev-2',
    });
    expect(camel.tableId).toBe('t2');
    expect(camel.clientInstanceId).toBe('dev-2');
  });

  it('notifies device feedback on kitchen pickup', () => {
    const result = service.handlePickupSse('kitchen', {
      TableId: 'table-a',
      clientInstanceId: 'device-x',
    });
    expect(result.tableId).toBe('table-a');
    expect(deviceFeedback.notifyPickupReady).toHaveBeenCalledWith('kitchen', {
      tableId: 'table-a',
      clientInstanceId: 'device-x',
    });
  });

  it('skips notify when table id missing', () => {
    service.handlePickupSse('bar', { ClientInstanceId: 'x' });
    expect(deviceFeedback.notifyPickupReady).not.toHaveBeenCalled();
  });
});
