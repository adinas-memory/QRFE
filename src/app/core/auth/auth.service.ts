import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
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

  constructor(private http: HttpClient) {}

  // --- Public API ---

  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  getUserRoles(): string[] {
      const roles = this.userSubject.value?.roles;
      if (!roles) return [];
      return Array.isArray(roles) ? roles : [roles];
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
    headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- Session management ---

  setUser(user: UserContextModel): void {
    this.userSubject.next(user);
    localStorage.setItem('AuthToken', JSON.stringify(user));
  }

  clearUser(): void {
    this.userSubject.next(null);
    localStorage.removeItem('AuthToken');
  }

restoreSession(): Observable<UserContextModel | null> {
  const raw = localStorage.getItem('AuthToken');
  if (raw) {
    try {
      const user = JSON.parse(raw) as UserContextModel;
      this.userSubject.next(user);
      return of(user);
    } catch {
      this.userSubject.next(null);
      return of(null);
    }
  }

  this.userSubject.next(null);
  return of(null);
}


  // --- Refresh from backend ---
  refreshUserContext() {
    return this.http.post<UserContextModel>(`${this.apiUrl}/api/user/refresh-token`, {}, { withCredentials: true }).pipe(
      tap(user => {
        this.setUser(user);
      }),
      catchError(err => {
        console.error('Refresh failed', err);
        this.clearUser();
        return of(null);
      })
    );
  }
}
