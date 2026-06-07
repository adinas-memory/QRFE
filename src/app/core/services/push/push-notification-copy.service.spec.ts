import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { PushNotificationCopyService } from './push-notification-copy.service';

describe('PushNotificationCopyService', () => {
  let service: PushNotificationCopyService;

  const translations: Record<string, string> = {
    'push.kitchenTitle': 'Kitchen',
    'push.barTitle': 'Bar',
    'push.tableTitle': 'Table',
    'push.defaultTitle': 'Notification',
    'push.pickupReady': 'Order ready for pickup',
    'push.pickupReadyTable': 'Order ready for pickup — {{table}}',
    'push.guestWaiterCall': 'Guest is calling the waiter',
    'push.guestWaiterCallTable': 'Guest is calling the waiter — {{table}}',
    'push.defaultBody': 'New event',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PushNotificationCopyService,
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string, params?: Record<string, string>) => {
              const template = translations[key] ?? key;
              if (!params) return template;
              return Object.entries(params).reduce(
                (acc, [k, v]) => acc.replace(`{{${k}}}`, v),
                template,
              );
            },
          },
        },
      ],
    });
    service = TestBed.inject(PushNotificationCopyService);
  });

  it('formats kitchen pickup with table', () => {
    expect(service.titleFor('KitchenWaiterCall')).toBe('Kitchen');
    expect(service.bodyFor('KitchenWaiterCall', 'Terasa 3')).toBe(
      'Order ready for pickup — Terasa 3',
    );
  });

  it('formats bar pickup without table', () => {
    expect(service.titleFor('BarWaiterCall')).toBe('Bar');
    expect(service.bodyFor('BarWaiterCall', null)).toBe('Order ready for pickup');
  });

  it('formats guest waiter call', () => {
    expect(service.titleFor('WaiterCall')).toBe('Table');
    expect(service.bodyFor('WaiterCall', 'T1')).toBe('Guest is calling the waiter — T1');
    expect(service.bodyFor('WaiterCall', null)).toBe('Guest is calling the waiter');
  });
});
