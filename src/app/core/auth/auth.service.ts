// core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserContext {
  id: string;
  roles: string[];
  restaurantIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private userSubject = new BehaviorSubject<UserContext | null>(null);

  // Expose as observable for components
  user$: Observable<UserContext | null> = this.userSubject.asObservable();

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
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  clearUser(): void {
    this.userSubject.next(null);
    localStorage.removeItem('auth_user');
  }

  restoreSession(): void {
    const raw = localStorage.getItem('auth_user');
    if (raw) {
      try {
        this.userSubject.next(JSON.parse(raw));
      } catch {
        this.userSubject.next(null);
      }
    }
  }
}
