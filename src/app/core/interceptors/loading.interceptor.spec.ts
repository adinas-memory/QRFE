import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';
import { FORCE_GLOBAL_LOADING, loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
        LoadingService,
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('toggles global loading for staff GET until complete', async () => {
    const p = firstValueFrom(http.get('/api/restaurants/x/staff/menu'));
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeTrue();
    httpMock.expectOne('/api/restaurants/x/staff/menu').flush([]);
    await p;
    expect(visible).toBeFalse();
  });

  it('toggles global loading for staff POST until complete', async () => {
    const p = firstValueFrom(
      http.post('/api/restaurants/x/staff/tables/t1/orders/o1/add-order-item', {}),
    );
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeTrue();
    httpMock
      .expectOne('/api/restaurants/x/staff/tables/t1/orders/o1/add-order-item')
      .flush({});
    await p;
    expect(visible).toBeFalse();
  });

  it('does not toggle global loading for refresh-token', async () => {
    const p = firstValueFrom(http.post('/api/user/refresh-token', {}));
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeFalse();
    httpMock.expectOne('/api/user/refresh-token').flush({});
    await p;
    expect(visible).toBeFalse();
  });

  it('keeps counter balanced across parallel requests', async () => {
    const p1 = firstValueFrom(http.get('/api/a'));
    const p2 = firstValueFrom(http.get('/api/b'));
    const states: boolean[] = [];
    loading.loading$.subscribe(v => states.push(v));

    httpMock.expectOne('/api/a').flush([]);
    await p1;
    expect(states.at(-1)).toBeTrue();

    httpMock.expectOne('/api/b').flush([]);
    await p2;
    expect(states.at(-1)).toBeFalse();
  });

  it('does not leak counter when SSE url is skipped (regression)', async () => {
    const p = firstValueFrom(http.get('/sse/internal/restaurant/x'));
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeFalse();
    httpMock.expectOne('/sse/internal/restaurant/x').flush({});
    await p;
    expect(visible).toBeFalse();
  });

  it('can force loading on skipped ping-lite via context token', async () => {
    const ctx = new HttpContext().set(FORCE_GLOBAL_LOADING, true);
    const p = firstValueFrom(http.head('/api/ping-lite', { context: ctx }));
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeTrue();
    httpMock.expectOne('/api/ping-lite').flush({});
    await p;
    expect(visible).toBeFalse();
  });
});
