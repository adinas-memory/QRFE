import { TestBed } from '@angular/core/testing';

import { OrderSyncService } from './order-sync.service';

describe('OrderSyncService', () => {
  let service: OrderSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderSyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
