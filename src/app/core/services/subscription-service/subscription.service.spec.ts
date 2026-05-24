import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';

import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put', 'request']);

    TestBed.configureTestingModule({
      providers: [
        SubscriptionService,
        { provide: HttpClient, useValue: spy }
      ]
    });
    service = TestBed.inject(SubscriptionService);
    httpSpy = TestBed.inject(HttpClient) as jasmine.SpyObj<HttpClient>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
