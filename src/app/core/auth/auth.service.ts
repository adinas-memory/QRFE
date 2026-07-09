import { Router } from '@angular/router';
import { Injectable, Injector } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject, Observable, Subject, catchError, finalize, firstValueFrom, from, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UserContextModel } from '../models/userContextModel';
import { RegisterUserRequestModel } from '../models/registerUserRequestModel';
import { environment } from '../../../environments/environment';
import { LoginUserRequestModel } from '../models/loginUserRequestModel';
import { debugLog } from '../offline/debug-log.util';
import { PushRegistrationService } from '../services/push/push-registration.service';
import { normalizeRestaurantId } from './restaurant-id.util';
import { NATIVE_AUTH_HEADER, NativeAuthTokenService } from './native-auth-token.service';
import { acquireRefreshLeader, initRefreshCoordinator, releaseRefreshLeader, tryAcquireRefreshLeaderSync } from './auth-refresh-coordinator';

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

  const isOfflinePrimaryDevice = readOptionalBool(r, 'isOfflinePrimaryDevice', 'IsOfflinePrimaryDevice');
  const isOfflinePrimaryStaffDesignee = readOptionalBool(
    r,
    'isOfflinePrimaryStaffDesignee',
    'IsOfflinePrimaryStaffDesignee',
  );

  return {
    id,
    role,
    restaurantId: normalizeRestaurantId((r['restaurantId'] ?? r['RestaurantId'] ?? null) as string | null),
    restaurantName: (r['restaurantName'] ?? r['RestaurantName'] ?? null) as string | null,
    restaurantType: (r['restaurantType'] ?? r['RestaurantType'] ?? null) as string | null,
    displayName: (r['displayName'] ?? r['DisplayName'] ?? null) as string | null,
    name: (r['name'] ?? r['Name'] ?? null) as string | null,
    surname: (r['surname'] ?? r['Surname'] ?? null) as string | null,
    email: (r['email'] ?? r['Email'] ?? null) as string | null,
    ...(isOfflinePrimaryDevice !== undefined ? { isOfflinePrimaryDevice } : {}),
    ...(isOfflinePrimaryStaffDesignee !== undefined ? { isOfflinePrimaryStaffDesignee } : {}),
  };
}

function readOptionalBool(
  raw: Record<string, unknown>,
  camelKey: string,
  pascalKey: string,
): boolean | undefined {
  if (!(camelKey in raw) && !(pascalKey in raw)) return undefined;
  return readBool(raw[camelKey] ?? raw[pascalKey]);
}

function readBool(value: unknown): boolean {
  return value === true || value === 'true';
}

function mergeUserContext(
  incoming: UserContextModel,
  previous: UserContextModel | null,
): UserContextModel {
  return {
    ...incoming,
    restaurantId: normalizeRestaurantId(incoming.restaurantId) ?? normalizeRestaurantId(previous?.restaurantId ?? null),
    restaurantName: incoming.restaurantName ?? previous?.restaurantName ?? null,
    restaurantType: incoming.restaurantType ?? previous?.restaurantType ?? null,
    displayName: incoming.displayName ?? previous?.displayName ?? null,
    name: incoming.name ?? previous?.name ?? null,
    surname: incoming.surname ?? previous?.surname ?? null,
    email: incoming.email ?? previous?.email ?? null,
    isOfflinePrimaryDevice: incoming.isOfflinePrimaryDevice ?? previous?.isOfflinePrimaryDevice ?? false,
    isOfflinePrimaryStaffDesignee: incoming.isOfflinePrimaryStaffDesignee ?? previous?.isOfflinePrimaryStaffDesignee ?? false,
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
  /** Shared in-flight refresh stream — assigned synchronously before HTTP subscribe. */
  private refreshShared$: Observable<UserContextModel | null> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private injector: Injector,
    private nativeAuthTokens: NativeAuthTokenService,
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
    const id = this.userSubject.value?.restaurantId ?? null;
    if (Array.isArray(id)) {
      const assigned = id.map(v => normalizeRestaurantId(v)).filter((v): v is string => v != null);
      return assigned.length ? assigned : null;
    }
    return normalizeRestaurantId(id);
  }

  loginUser(payload: LoginUserRequestModel): Observable<unknown> {
    const url = `${this.apiUrl}/api/user/login`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.nativeAuthTokens.isEnabled()) {
      headers[NATIVE_AUTH_HEADER] = '1';
    }
    debugLog('auth', 'auth.service.ts:loginUser', 'login attempt', {
      url,
      pageProtocol: typeof window !== 'undefined' ? window.location.protocol : null,
      nativeAuth: this.nativeAuthTokens.isEnabled(),
      hypothesisId: 'H4-login-fails',
    });
    return this.http.post(url, payload, {
      headers,
      withCredentials: true,
    }).pipe(
      tap((response) => {
        this.nativeAuthTokens.captureFromAuthPayload(response);
      }),
    );
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
  setUser(raw: UserContextModel | Record<string, unknown>): void {
    const wasLoggedOut = !this.userSubject.value;
    const previous = this.userSubject.value;
    const incoming = normalizeUserContext(raw) ?? (raw as UserContextModel);
    const merged = mergeUserContext(incoming, previous);
    this.userSubject.next(merged);
    localStorage.setItem('UserCtx', JSON.stringify(merged));
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
    void this.nativeAuthTokens.clear();
  }

  /**
   * Native startup: restore local UserCtx then validate/renew via refresh-token cookie (7d).
   * Does not navigate on failure — caller shows login when unauthenticated.
   */
  async tryRestoreNativeSession(): Promise<UserContextModel | null> {
    await this.nativeAuthTokens.initialize();
    await firstValueFrom(this.restoreSession());
    return firstValueFrom(this.refreshUserContext({ redirectOnFailure: false }));
  }

  /** PWA startup: restore UserCtx then validate/renew via refresh-token cookie. */
  async tryRestoreWebSession(): Promise<UserContextModel | null> {
    initRefreshCoordinator();
    await firstValueFrom(this.restoreSession());
    if (!this.isAuthenticated()) {
      debugLog('auth', 'auth.service.ts:tryRestoreWebSession', 'no UserCtx in storage', {
        hypothesisId: 'H28-startup-restore',
      });
      return null;
    }
    const user = await firstValueFrom(this.refreshUserContext({ redirectOnFailure: false }));
    debugLog('auth', 'auth.service.ts:tryRestoreWebSession', user ? 'startup refresh ok' : 'startup refresh failed', {
      hypothesisId: 'H28-startup-restore',
      hasUser: !!user,
    });
    return user;
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
    const pingOptions = {
      withCredentials: true,
      headers: this.nativeAuthTokens.authHeaders(),
    };
    return this.http.get<unknown>(`${this.apiUrl}/api/user/ping`, pingOptions).pipe(
      map(raw => normalizeUserContext(raw)),
      tap(user => {
        if (user) this.setUser(user);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isPublic) {
          return this.refreshUserContext({ redirectOnFailure: false }).pipe(
            switchMap(user => {
              this.hydrateSessionFromStorageIfNeeded();
              if (!user && !this.isAuthenticated()) {
                console.warn('Refresh credentials failed. Redirect @Login.');
                return of(null);
              }
              return this.http.get<unknown>(`${this.apiUrl}/api/user/ping`, pingOptions).pipe(
                map(raw => normalizeUserContext(raw)),
                tap(u => {
                  if (u) this.setUser(u);
                }),
                catchError(() => of(null)),
              );
            }),
          );
        }
        console.warn('Ping failed, but route is public or error is not 401.');
        return of(null);
      })
    );
  }

  refreshUserContext(options?: { redirectOnFailure?: boolean }): Observable<UserContextModel | null> {
    const redirectOnFailure = options?.redirectOnFailure ?? true;
    if (this.refreshShared$) {
      // #region agent log
      debugLog('auth', 'auth.service.ts:refreshUserContext', 'refresh joined in-flight', {
        hypothesisId: 'H26-same-tab-singleflight',
      });
      // #endregion agent log
      return this.refreshShared$;
    }

    if (!this.nativeAuthTokens.isEnabled()) {
      this.hydrateSessionFromStorageIfNeeded();
      const hasLocalSession = !!localStorage.getItem('UserCtx') || !!this.userSubject.value;
      if (!hasLocalSession) {
        debugLog('auth', 'auth.service.ts:refreshUserContext', 'refresh skipped no local session', {
          hypothesisId: 'H29-no-local-session',
        });
        return of(null);
      }
    }

    const refresh$ = (this.nativeAuthTokens.isEnabled()
      ? from(this.nativeAuthTokens.initialize())
      : of(undefined)
    ).pipe(
      switchMap(() => {
        if (this.nativeAuthTokens.isEnabled()) {
          return from(acquireRefreshLeader());
        }
        const syncRole = tryAcquireRefreshLeaderSync();
        if (syncRole === 'contended') {
          return from(acquireRefreshLeader());
        }
        if (syncRole === 'leader') {
          debugLog('auth', 'auth-refresh-coordinator.ts', 'refresh leader acquired', {
            hypothesisId: 'H23-refresh-singleflight',
          });
        }
        return of(syncRole);
      }),
      switchMap((role) => {
        if (role === 'follower' && !this.nativeAuthTokens.isEnabled()) {
          this.hydrateSessionFromStorageIfNeeded();
          const snapshot = this.getUserSnapshot();
          // #region agent log
          debugLog('auth', 'auth.service.ts:refreshUserContext', 'refresh skipped follower', {
            hasUser: !!snapshot,
            role: snapshot?.role ?? null,
            hypothesisId: 'H23-refresh-singleflight',
          });
          // #endregion agent log
          return of(snapshot);
        }

        const refreshBody = this.nativeAuthTokens.isEnabled()
          ? { refreshToken: this.nativeAuthTokens.getRefreshToken() }
          : {};
        const refreshHeaders: Record<string, string> = {};
        if (this.nativeAuthTokens.isEnabled()) {
          refreshHeaders[NATIVE_AUTH_HEADER] = '1';
          const rt = refreshBody.refreshToken;
          debugLog('auth', 'auth.service.ts', 'native refresh request', {
            hasRefreshToken: !!rt,
            refreshLen: rt?.length ?? 0,
            refreshHasPercent: rt?.includes('%') ?? false,
            refreshStartsDollar2a: rt?.startsWith('$2') ?? false,
            hypothesisId: 'H10-refresh-decode',
          });
        }

        // #region agent log
        debugLog('auth', 'auth.service.ts:refreshUserContext', 'refresh start', {
          nativeAuth: this.nativeAuthTokens.isEnabled(),
          hasUserCtx: !!localStorage.getItem('UserCtx'),
          hypothesisId: 'H16-refresh-401',
        });
        // #endregion agent log

        const sentRefreshToken = this.nativeAuthTokens.isEnabled()
          ? !!refreshBody.refreshToken
          : true;

        return this.http
          .post<unknown>(`${this.apiUrl}/api/user/refresh-token`, refreshBody, {
            withCredentials: true,
            headers: refreshHeaders,
          })
          .pipe(
            tap((raw) => {
              this.nativeAuthTokens.captureFromAuthPayload(raw);
            }),
            map(raw => this.resolveUserAfterRefresh(raw)),
            tap(user => {
              if (user) this.setUser(user);
              // #region agent log
              debugLog('auth', 'auth.service.ts:refreshUserContext', user ? 'refresh ok' : 'refresh empty user', {
                hasUser: !!user,
                role: user?.role ?? null,
                hypothesisId: 'H16-refresh-401',
              });
              // #endregion agent log
            }),
            catchError(err => {
              debugLog('auth', 'auth.service.ts:refreshUserContext', 'refresh failed', {
                status: (err as HttpErrorResponse)?.status ?? null,
                hasUserCtx: !!localStorage.getItem('UserCtx'),
                sentRefreshToken,
                hypothesisId: 'H16-refresh-401',
              });
              console.error('Refresh failed', err);
              if (isHttpAuthFailure(err) && sentRefreshToken) {
                this.clearUser();
                if (redirectOnFailure) {
                  void this.router.navigate(['/login']);
                }
              }
              return of(null);
            }),
            finalize(() => {
              if (role === 'leader') {
                releaseRefreshLeader(!!this.getUserSnapshot());
              }
            }),
          );
      }),
    );

    // Assign before subscribe so concurrent callers in the same tick join one stream.
    const shared$ = refresh$.pipe(
      finalize(() => {
        this.refreshShared$ = null;
      }),
      shareReplay(1),
    );
    this.refreshShared$ = shared$;
    return shared$;
  }

  /** After refresh, cookies hold the new JWT; keep local ctx if body omits user fields. */
  private resolveUserAfterRefresh(raw: unknown): UserContextModel | null {
    const normalized = normalizeUserContext(raw);
    if (normalized) return normalized;
    if (isRefreshSuccess(raw)) {
      this.hydrateSessionFromStorageIfNeeded();
      return this.getUserSnapshot();
    }
    return null;
  }

  logout(): Observable<void> {
    this.unregisterPushToken();
    this.clearUser();
    this.clearRestaurantCtx();
    return this.http.post<void>(`${this.apiUrl}/api/user/logout`, {}, { withCredentials: true }).pipe(
      map(() => undefined as void),
      catchError(err => {
        console.warn('Logout API call failed; local session already cleared', err);
        return of(undefined as void);
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
