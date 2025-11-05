import { TestBed } from '@angular/core/testing';

import { QrCodesService } from './qr-codes.service';

describe('QrCodesService', () => {
  let service: QrCodesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QrCodesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
