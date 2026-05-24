import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageOrdersComponent } from './manage-orders.component';
import { AuthService } from '../../../core/auth/auth.service';
import { OrderSyncService } from '../../../core/services/order-service/order-sync.service';
import { OfflineDbService } from '../../../core/offline/offline-db';
import { OfflineQueueProcessor } from '../../../core/offline/offline-queue-processor.service';
import { OnlineStateService } from '../../../core/offline/online-state-service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';
import { of, Subject } from 'rxjs';

describe('ManageOrdersComponent', () => {
  let component: ManageOrdersComponent;
  let fixture: ComponentFixture<ManageOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageOrdersComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        {
          provide: AuthService,
          useValue: {
            getUserContext: () =>
              of({ id: '1', role: 'staff', restaurantId: '00000000-0000-0000-0000-000000000001' }),
          },
        },
        { provide: OrderSyncService, useValue: { events$: new Subject().asObservable() } },
        {
          provide: OfflineDbService,
          useValue: {
            loadTablesStatusMap: () => Promise.resolve({}),
            loadComputed: () => ({}),
            loadAllCarts: () => Promise.resolve({}),
          },
        },
        { provide: OfflineQueueProcessor, useValue: { orderConfirmed$: new Subject().asObservable() } },
        { provide: OnlineStateService, useValue: { isOnline: true, online$: of(true) } },
        { provide: AppToastService, useValue: { success: (): void => {}, error: (): void => {}, info: (): void => {} } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
