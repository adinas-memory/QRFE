import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { QrCodesService } from './qr-codes.service';

describe('QrCodesService', () => {
  let service: QrCodesService;

  beforeEach(() => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put']);
    TestBed.configureTestingModule({
      providers: [
        QrCodesService,
        { provide: HttpClient, useValue: httpSpy }
      ]
    });
    service = TestBed.inject(QrCodesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
