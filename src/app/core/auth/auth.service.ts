// core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface UserContext {
  id: string;
  roles: string[];
  restaurantIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserContext | null>(null);
  user$: Observable<UserContext | null> = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  // --- Public API ---

  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  getUserRoles(): string[] {
    return this.userSubject.value?.roles ?? [];
  }

  getUserRestaurantIds(): string[] {
    return this.userSubject.value?.restaurantIds ?? [];
  }

  // --- Session management ---

  setUser(user: UserContext): void {
    this.userSubject.next(user);
    localStorage.setItem('AuthToken', JSON.stringify(user));
  }

  clearUser(): void {
    this.userSubject.next(null);
    localStorage.removeItem('AuthToken');
  }

restoreSession(): Observable<UserContext | null> {
  const raw = localStorage.getItem('AuthToken');
  if (raw) {
    try {
      const user = JSON.parse(raw) as UserContext;
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
    return this.http.post<UserContext>('/api/user/refresh-token', {}, { withCredentials: true }).pipe(
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
