import { Router } from '@angular/router';
import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UserContextModel } from '../models/userContextModel';
import { RegisterUserRequestModel } from '../models/registerUserRequestModel';
import { environment } from '../../../environments/environment';
import { LoginUserRequestModel } from '../models/loginUserRequestModel';
import { PushRegistrationService } from '../services/push/push-registration.service';

export function isHttpAuthFailure(err: unknown): boolean {
  const status = (err as HttpErrorResponse)?.status;
  return status === 401 || status === 403;
}

/** Normalizes API user payloads (camelCase or PascalCase). */
export function normalizeUserContext(raw: unknown): UserContextModel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = (r['id'] ?? r['Id']) as string | undefined;
  const role = (r['role'] ?? r['Role']) as string | undefined;
  if (!id || !role) return null;
  return {
    id,
    role,
    restaurantId: (r['restaurantId'] ?? r['RestaurantId'] ?? null) as string | null,
    restaurantName: (r['restaurantName'] ?? r['RestaurantName'] ?? null) as string | null,
    restaurantType: (r['restaurantType'] ?? r['RestaurantType'] ?? null) as string | null,
  };
}

function isRefreshSuccess(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return true;
  const r = raw as Record<string, unknown>;
  if ('isSuccess' in r) return r['isSuccess'] === true;
  if ('IsSuccess' in r) return r['IsSuccess'] === true;
  return true;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserContextModel | null>(null);
  user$: Observable<UserContextModel | null> = this.userSubject.asObservable();
  readonly loggedIn$ = new Subject<void>();
  // use environment variable
  private apiUrl = environment.apiUrl;
  /** Shared in-flight refresh — prevents parallel refresh-token calls that invalidate each other. */
  private refreshInFlight: Observable<UserContextModel | null> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private injector: Injector,
  ) { }

  // --- Public API ---

  // auth.service.ts
  getUserSnapshot(): UserContextModel | null {
    return this.userSubject?.value ?? null;
  }

  getUserContext(): Observable<UserContextModel | null> {
    return this.user$;
  }

  /**
   * Re-hydrate in-memory session from UserCtx when storage still has a session but
   * userSubject was not populated yet (startup race) or was cleared without storage.
   */
  hydrateSessionFromStorageIfNeeded(): void {
    if (this.userSubject.value) {
      return;
    }
    const raw = localStorage.getItem('UserCtx');
    if (!raw) {
      return;
    }
    try {
      const user = JSON.parse(raw) as UserContextModel;
      if (!user?.id || !user?.role) {
        return;
      }
      this.userSubject.next(user);
      this.setRestaurantCtx();
    } catch {
      // ignore parse errors
    }
  }

  isAuthenticated(): boolean {
    this.hydrateSessionFromStorageIfNeeded();
    return this.userSubject.value !== null;
  }

  getUserRole(): string | null {
    this.hydrateSessionFromStorageIfNeeded();
    return this.userSubject.value?.role ?? null;
  }

  getUserRestaurantId(): string | string[] | null {
    this.hydrateSessionFromStorageIfNeeded();
    return this.userSubject.value?.restaurantId ?? null;
  }

  loginUser(payload: LoginUserRequestModel): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/user/login`, payload, {
      headers: { 'Content-Type': 'application/json' }, withCredentials: true
    });
  }

  registerUser(payload: RegisterUserRequestModel): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/user/register`, payload, {
      headers: { 'Content-Type': 'application/json' }, withCredentials: true
    });
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/user/forgot-password`,
      { email },
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/user/reset-password`,
      { token, newPassword },
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/user/verify-email`,
      { token },
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  resendVerification(email: string): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/api/user/resend-verification`,
      { email },
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- Session management ---
  setUser(user: UserContextModel): void {
    const wasLoggedOut = !this.userSubject.value;  // era delogat înainte?
    this.userSubject.next(user);
    localStorage.setItem('UserCtx', JSON.stringify(user));
    this.setRestaurantCtx();

    if (wasLoggedOut) {
      this.loggedIn$.next();  // ← emite doar la login real, nu la restore session
    }
  }

  setRestaurantCtx(): void {
    const ctx = {
      name: this.userSubject.value?.restaurantName ?? '',
      type: this.userSubject.value?.restaurantType ?? ''
    };

    localStorage.setItem('RestaurantCtx', JSON.stringify(ctx));
  }

  clearRestaurantCtx(): void {
    localStorage.removeItem('RestaurantCtx');
  }

  getRestaurantCtx() {
    const raw = localStorage.getItem('RestaurantCtx');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }


  clearUser(): void {
    this.userSubject.next(null);
    localStorage.removeItem('UserCtx');
  }

  restoreSession(): Observable<UserContextModel | null> {
    const raw = localStorage.getItem('UserCtx');
    if (raw) {
      try {
        const user = JSON.parse(raw) as UserContextModel;
        this.userSubject.next(user);
        localStorage.setItem('UserCtx', JSON.stringify(user));
        this.setRestaurantCtx();
        return of(user);
      } catch {
        console.warn('[AuthService] Failed to parse UserCtx');
        this.userSubject.next(null);
        this.clearRestaurantCtx();
        return of(null);
      }
    }

    this.userSubject.next(null);
    this.clearRestaurantCtx();
    return of(null);
  }
  // --- Refresh from backend ---

  pingSession(isPublic: boolean = false): Observable<UserContextModel | null> {
    return this.http.get<UserContextModel>(`${this.apiUrl}/api/user/ping`, { withCredentials: true }).pipe(
      tap(user => {
        this.setUser(user);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublic) {
          return this.refreshUserContext().pipe(
            tap(user => {
              if (!user) {
                console.warn('Refresh credentials failed. Redirect @Login.');
              }
            })
          );
        } else {
          console.warn('Ping failed, but route is public or error is not 401.');
          return of(null);
        }
      })
    );
  }

  refreshUserContext(): Observable<UserContextModel | null> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.http
      .post<unknown>(`${this.apiUrl}/api/user/refresh-token`, {}, { withCredentials: true })
      .pipe(
        map(raw => this.resolveUserAfterRefresh(raw)),
        tap(user => {
          if (user) this.setUser(user);
        }),
        catchError(err => {
          console.error('Refresh failed', err);
          if (isHttpAuthFailure(err)) {
            this.clearUser();
            this.router.navigate(['/login']);
          }
          return of(null);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay(1),
      );

    return this.refreshInFlight;
  }

  /** After refresh, cookies hold the new JWT; keep local ctx if body omits user fields. */
  private resolveUserAfterRefresh(raw: unknown): UserContextModel | null {
    const normalized = normalizeUserContext(raw);
    if (normalized) return normalized;
    if (isRefreshSuccess(raw)) {
      return this.getUserSnapshot();
    }
    return null;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/user/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.unregisterPushToken();
        this.clearUser();
        this.clearRestaurantCtx();
      }),
      catchError(err => {
        console.error('Logout error', err);
        this.unregisterPushToken();
        this.clearUser();
        this.clearRestaurantCtx();
        return of(undefined as unknown as void);
      }),
    );
  }

  private unregisterPushToken(): void {
    try {
      void this.injector.get(PushRegistrationService).unregisterCurrentToken();
    } catch {
      // optional on web-only bundles
    }
  }


  deleteCookie(name: string, path: string = '/', domain?: string): void {
    let cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
    if (domain) {
      cookie += `;domain=${domain}`;
    }
    document.cookie = cookie;
  }

}
