import { Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, catchError, map, of, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UserContextModel } from '../models/userContextModel';
import { RegisterUserRequestModel } from '../models/registerUserRequestModel';
import { environment } from '../../../environments/environment';
import { LoginUserRequestModel } from '../models/loginUserRequestModel';



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

  // --- Session management ---
  setUser(user: UserContextModel): void {
    const wasLoggedOut = !this.userSubject.value;  // era delogat înainte?
    this.userSubject.next(user);
    localStorage.setItem('UserCtx', JSON.stringify(user));

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
        console.log('[AuthService] Restoring user:', user);
        this.userSubject.next(user);
        return of(user);
      } catch {
        console.warn('[AuthService] Failed to parse UserCtx');
        this.userSubject.next(null);
        return of(null);
      }
    }

    this.userSubject.next(null);
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
              if (user) {
                console.log('Refresh credentials OK.');
              } else {
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
    return this.http.post<UserContextModel>(`${this.apiUrl}/api/user/refresh-token`, {}, { withCredentials: true }).pipe(
      tap(user => {
        this.setUser(user);
      }),
      catchError(err => {
        console.error('Refresh failed', err);
        this.clearUser();
        this.router.navigate(['/login']);
        return of(null);
      })
    );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/api/user/logout`, {}, { withCredentials: true })
      .subscribe(_ => {
        this.clearUser();
        this.clearRestaurantCtx();
      });
  }


  deleteCookie(name: string, path: string = '/', domain?: string): void {
    let cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
    if (domain) {
      cookie += `;domain=${domain}`;
    }
    document.cookie = cookie;
  }

}
