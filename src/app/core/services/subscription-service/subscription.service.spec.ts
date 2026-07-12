import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { SubscriptionService } from './subscription.service';
import { environment } from '../../../../environments/environment';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SubscriptionService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SubscriptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getProducts requests market query param', async () => {
    const resultPromise = firstValueFrom(service.getProducts('RO'));

    const req = httpMock.expectOne(
      r => r.url === `${environment.apiUrl}/api/stripe/subscription` && r.params.get('market') === 'RO',
    );
    expect(req.request.method).toBe('GET');
    req.flush([{ priceId: 'price_ro', restaurantType: 'small', market: 'RO' }]);

    const products = await resultPromise;
    expect(products.length).toBe(1);
    expect(products[0].market).toBe('RO');
  });

  it('deleteProduct calls admin delete endpoint', async () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const resultPromise = firstValueFrom(service.deleteProduct(id));

    const req = httpMock.expectOne(`${environment.apiUrl}/api/restaurants/subscription-products/${id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ isDeleted: true, productPriceId: id });

    const result = await resultPromise;
    expect(result.isDeleted).toBeTrue();
  });

  it('cancelSubscription parses legacy plain-text 200 response', async () => {
    const resultPromise = firstValueFrom(service.cancelSubscription());

    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush('Subscription cancelled.', {
      status: 200,
      statusText: 'OK',
    });

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription/status`);
    statusReq.flush({
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
      cancelAtUtc: '2026-07-12T00:00:00.000Z',
    });

    const result = await resultPromise;
    expect(result.isCancelled).toBeTrue();
    expect(result.cancelAtPeriodEnd).toBeTrue();
    expect(result.cancelAtUtc).toBe('2026-07-12T00:00:00.000Z');
  });

  it('cancelSubscription falls back when legacy text response and status endpoint is missing', async () => {
    const resultPromise = firstValueFrom(service.cancelSubscription());

    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription`);
    deleteReq.flush('Subscription cancelled.', { status: 200, statusText: 'OK' });

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription/status`);
    statusReq.flush('not found', { status: 404, statusText: 'Not Found' });

    const result = await resultPromise;
    expect(result.isCancelled).toBeTrue();
    expect(result.cancelAtPeriodEnd).toBeTrue();
    expect(result.cancelAtUtc).toBeNull();
  });

  it('cancelSubscription parses JSON response body', async () => {
    const resultPromise = firstValueFrom(service.cancelSubscription());

    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription`);
    deleteReq.flush(
      JSON.stringify({
        isCancelled: true,
        cancelAtPeriodEnd: true,
        cancelAtUtc: '2026-07-12T00:00:00.000Z',
        subscriptionStatus: 'active',
      }),
      { status: 200, statusText: 'OK' },
    );

    const result = await resultPromise;
    expect(result.cancelAtUtc).toBe('2026-07-12T00:00:00.000Z');
    expect(result.cancelAtPeriodEnd).toBeTrue();
  });

  it('cancelSubscription reloads status when response body is empty', async () => {
    const resultPromise = firstValueFrom(service.cancelSubscription());

    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription`);
    deleteReq.flush('', { status: 200, statusText: 'OK' });

    const statusReq = httpMock.expectOne(`${environment.apiUrl}/api/stripe/subscription/status`);
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
      cancelAtUtc: '2026-07-12T00:00:00.000Z',
    });

    const result = await resultPromise;
    expect(result.cancelAtPeriodEnd).toBeTrue();
    expect(result.cancelAtUtc).toBe('2026-07-12T00:00:00.000Z');
  });
});
