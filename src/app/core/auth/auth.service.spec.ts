import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService, isHttpAuthFailure, normalizeUserContext } from './auth.service';
import { UserContextModel } from '../models/userContextModel';
import { environment } from '../../../environments/environment';

describe('isHttpAuthFailure', () => {
  it('returns true for 401 and 403', () => {
    expect(isHttpAuthFailure(new HttpErrorResponse({ status: 401 }))).toBe(true);
    expect(isHttpAuthFailure(new HttpErrorResponse({ status: 403 }))).toBe(true);
  });

  it('returns false for network and other errors', () => {
    expect(isHttpAuthFailure(new HttpErrorResponse({ status: 0 }))).toBe(false);
    expect(isHttpAuthFailure(new HttpErrorResponse({ status: 500 }))).toBe(false);
  });
});

describe('normalizeUserContext', () => {
  it('maps camelCase and PascalCase payloads', () => {
    expect(normalizeUserContext({ id: '1', role: 'staff', restaurantId: 'r1' })).toEqual({
      id: '1',
      role: 'staff',
      restaurantId: 'r1',
      restaurantName: null,
      restaurantType: null,
      displayName: null,
      name: null,
      surname: null,
      email: null,
    });
    expect(normalizeUserContext({ Id: '2', Role: 'manager', RestaurantId: 'r2' })).toEqual({
      id: '2',
      role: 'manager',
      restaurantId: 'r2',
      restaurantName: null,
      restaurantType: null,
      displayName: null,
      name: null,
      surname: null,
      email: null,
    });
    expect(
      normalizeUserContext({
        id: '3',
        role: 'staff',
        isOfflinePrimaryDevice: true,
        IsOfflinePrimaryStaffDesignee: true,
      }),
    ).toEqual({
      id: '3',
      role: 'staff',
      restaurantId: null,
      restaurantName: null,
      restaurantType: null,
      displayName: null,
      name: null,
      surname: null,
      email: null,
      isOfflinePrimaryDevice: true,
      isOfflinePrimaryStaffDesignee: true,
    });
  });
});

describe('AuthService offline session handling', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    router = jasmine.createSpyObj('Router', ['navigate']);
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('refreshUserContext on network error (status 0) does not logout', () => {
    service.setUser({ id: '1', role: 'manager', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' });

    service.refreshUserContext().subscribe(result => {
      expect(result).toBeNull();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    expect(req.request.method).toBe('POST');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(true);
  });

  it('refreshUserContext on 401 clears session and navigates to login', () => {
    service.setUser({ id: '1', role: 'manager', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' });

    service.refreshUserContext().subscribe(result => {
      expect(result).toBeNull();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refreshUserContext with redirectOnFailure false does not navigate on 401', () => {
    service.setUser({ id: '1', role: 'manager', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' });

    service.refreshUserContext({ redirectOnFailure: false }).subscribe(result => {
      expect(result).toBeNull();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('refreshUserContext deduplicates concurrent calls', () => {
    service.setUser({ id: '1', role: 'manager', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' });

    let first: UserContextModel | null | undefined;
    let second: UserContextModel | null | undefined;
    service.refreshUserContext().subscribe(v => (first = v));
    service.refreshUserContext().subscribe(v => (second = v));

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    req.flush({ IsSuccess: true, Id: '1', Role: 'manager', RestaurantId: 'r1' });

    expect(first?.id).toBe('1');
    expect(second?.id).toBe('1');
  });

  it('hydrateSessionFromStorageIfNeeded restores user from UserCtx when subject is empty', () => {
    const user: UserContextModel = {
      id: '1',
      role: 'manager',
      restaurantId: 'r1',
      restaurantName: null,
      restaurantType: null,
    };
    localStorage.setItem('UserCtx', JSON.stringify(user));

    expect(service.getUserRestaurantId()).toBe('r1');
    expect(service.isAuthenticated()).toBe(true);
  });

  it('refreshUserContext keeps snapshot when body has isSuccess only', () => {
    service.setUser({ id: '1', role: 'staff', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' });

    service.refreshUserContext().subscribe(result => {
      expect(result?.id).toBe('1');
      expect(result?.role).toBe('staff');
      expect(result?.restaurantName).toBe('R');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    req.flush({ isSuccess: true, message: 'refreshed successfully' });
  });

  it('refreshUserContext hydrates UserCtx when body has isSuccess only and subject is empty', () => {
    localStorage.setItem(
      'UserCtx',
      JSON.stringify({ id: '1', role: 'staff', restaurantId: 'r1', restaurantName: 'R', restaurantType: 'Small' }),
    );

    service.refreshUserContext().subscribe(result => {
      expect(result?.id).toBe('1');
      expect(result?.restaurantName).toBe('R');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/api/user/refresh-token`);
    req.flush({ isSuccess: true, message: 'refreshed successfully' });
  });

  it('setUser preserves restaurantName when ping omits it', () => {
    service.setUser({
      id: '1',
      role: 'manager',
      restaurantId: 'r1',
      restaurantName: 'Bistro',
      restaurantType: 'Small',
    });

    service.setUser({
      id: '1',
      role: 'manager',
      restaurantId: 'r1',
      restaurantName: null,
      restaurantType: null,
    });

    expect(service.getUserSnapshot()?.restaurantName).toBe('Bistro');
    expect(service.getUserSnapshot()?.restaurantType).toBe('Small');
  });

  it('setUser preserves offline flags when ping omits them', () => {
    service.setUser({
      id: '1',
      role: 'staff',
      restaurantId: 'r1',
      restaurantName: 'Bistro',
      restaurantType: 'Small',
      isOfflinePrimaryStaffDesignee: true,
      isOfflinePrimaryDevice: false,
    });

    service.setUser({
      id: '1',
      role: 'staff',
      restaurantId: 'r1',
      restaurantName: 'Bistro',
      restaurantType: 'Small',
    });

    expect(service.getUserSnapshot()?.isOfflinePrimaryStaffDesignee).toBe(true);
    expect(service.getUserSnapshot()?.isOfflinePrimaryDevice).toBe(false);
  });
});
