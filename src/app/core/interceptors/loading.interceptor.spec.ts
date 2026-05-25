import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LoadingService } from '../services/loading/loading.service';
import { navigationCancelInterceptor } from './navigation-cancel.interceptor';
import { FORCE_GLOBAL_LOADING, loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([loadingInterceptor, navigationCancelInterceptor]),
        ),
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

  it('toggles global loading for dashboard metrics GET', async () => {
    const p = firstValueFrom(
      http.get('/api/restaurants/x/staff/dashboard/metrics'),
    );
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeTrue();
    httpMock.expectOne('/api/restaurants/x/staff/dashboard/metrics').flush({});
    await p;
    expect(visible).toBeFalse();
  });

  it('does not toggle global loading for i18n assets', async () => {
    const p = firstValueFrom(http.get('/assets/i18n/en.json'));
    let visible = false;
    loading.loading$.subscribe(v => (visible = v));
    expect(visible).toBeFalse();
    httpMock.expectOne('/assets/i18n/en.json').flush({});
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
});
