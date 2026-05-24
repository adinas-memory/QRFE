import { Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, map, of, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UserContextModel } from '../models/userContextModel';
import { RegisterUserRequestModel } from '../models/registerUserRequestModel';
import { environment } from '../../../environments/environment';
import { LoginUserRequestModel } from '../models/loginUserRequestModel';

export function isHttpNetworkError(err: unknown): boolean {
  const status = (err as HttpErrorResponse)?.status;
  return status === 0;
}

export function isHttpAuthFailure(err: unknown): boolean {
  const status = (err as HttpErrorResponse)?.status;
  return status === 401 || status === 403;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserContextModel | null>(null);
  user$: Observable<UserContextModel | null> = this.userSubject.asObservable();
  readonly loggedIn$ = new Subject<void>();
  // use environment variable
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient,
    private router: Router) { }

  // --- Public API ---

  // auth.service.ts
  getUserSnapshot(): UserContextModel | null {
    return this.userSubject?.value ?? null;
  }

  getUserContext(): Observable<UserContextModel | null> {
    return this.user$;
  }

  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  getUserRole(): string | null {
    return this.userSubject.value?.role ?? null;
  }

  getUserRestaurantId(): string | string[] | null {
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

  refreshUserContext() {
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'auth.service.ts:refreshUserContext',message:'refresh_start',data:{},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
    return this.http.post<UserContextModel>(`${this.apiUrl}/api/user/refresh-token`, {}, { withCredentials: true }).pipe(
      tap(user => this.setUser(user)),
      catchError(err => {
        console.error('Refresh failed', err);
        const authFailure = isHttpAuthFailure(err);
        const networkError = isHttpNetworkError(err);
  // #region agent log
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'auth.service.ts:refreshUserContext',message:'refresh_failed',data:{status:(err as HttpErrorResponse)?.status,authFailure,networkError},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
        if (authFailure) {
          this.clearUser();
          this.router.navigate(['/login']);
        }
        return of(null);
      })
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/api/user/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearUser();
        this.clearRestaurantCtx();
      }),
      catchError(err => {
        console.error('Logout error', err);
        this.clearUser();
        this.clearRestaurantCtx();
        return of(undefined as unknown as void);
      }),
    );
  }


  deleteCookie(name: string, path: string = '/', domain?: string): void {
    let cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
    if (domain) {
      cookie += `;domain=${domain}`;
    }
    document.cookie = cookie;
  }

}
