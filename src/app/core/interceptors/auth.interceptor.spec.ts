import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { OnlineStateService } from '../offline/online-state-service';

describe('authInterceptor offline behavior', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let onlineState: jasmine.SpyObj<OnlineStateService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['refreshUserContext', 'clearUser']);
    onlineState = jasmine.createSpyObj('OnlineStateService', ['setOffline']);
    Object.defineProperty(onlineState, 'isOnline', { get: () => onlineState['_isOnline'] ?? true, configurable: true });
    (onlineState as any)._isOnline = true;
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: OnlineStateService, useValue: onlineState },
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('status 0 marks offline and does not call refreshUserContext', () => {
    http.get('/api/restaurants/x/staff/metrics').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/restaurants/x/staff/metrics');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(onlineState.setOffline).toHaveBeenCalled();
    expect(auth.refreshUserContext).not.toHaveBeenCalled();
    expect(auth.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('401 while offline does not call refreshUserContext', () => {
    (onlineState as any)._isOnline = false;

    http.get('/api/restaurants/x/staff/metrics').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/restaurants/x/staff/metrics');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshUserContext).not.toHaveBeenCalled();
    expect(auth.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('401 while online attempts refresh and retries request on success', () => {
    (onlineState as any)._isOnline = true;
    auth.refreshUserContext.and.returnValue(
      of({ id: '1', role: 'manager', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' })
    );

    let response: unknown;
    http.get('/api/restaurants/x/staff/metrics').subscribe({
      next: body => (response = body),
      error: () => fail('should not error'),
    });

    const req1 = httpMock.expectOne('/api/restaurants/x/staff/metrics');
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshUserContext).toHaveBeenCalled();

    const req2 = httpMock.expectOne('/api/restaurants/x/staff/metrics');
    req2.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(auth.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('401 while online with failed refresh only logs out on auth failure', () => {
    (onlineState as any)._isOnline = true;
    auth.refreshUserContext.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 0 }))
    );

    http.get('/api/restaurants/x/staff/metrics').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/restaurants/x/staff/metrics');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshUserContext).toHaveBeenCalled();
    expect(auth.clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
