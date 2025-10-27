import { Router } from '@angular/router';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { UserContextModel } from '../models/userContextModel';
import { RegisterUserRequestModel } from '../models/registerUserRequestModel';
import { environment } from '../../../environments/environment';
import { LoginUserRequestModel } from '../models/loginUserRequestModel';



@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserContextModel | null>(null);
  user$: Observable<UserContextModel | null> = this.userSubject.asObservable();
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
    this.userSubject.next(user);
    localStorage.setItem('UserCtx', JSON.stringify(user));
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

  pingSession(): Observable<UserContextModel | null> {
    return this.http.get<UserContextModel>(`${this.apiUrl}/api/user/ping`, { withCredentials: true }).pipe(
      tap(user => {
        // 200 OK: Set the user context
        this.setUser(user);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.refreshUserContext().pipe(
            tap(user => {
              if (user) {
                console.log('Refresh credetials OK.');
              } else {
                console.warn('Refresh credentials failed. redirect @Login.');
              }
            })
          );
        } else {
          console.error('Unexpected Error:', error);
          return throwError(() => error);
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



}
