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
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H1',location:'auth.service.ts:95',message:'setUser()',data:{hasUser:!!user,hasRestaurantName:!!user?.restaurantName,restaurantNameLen:(user?.restaurantName?.length ?? 0),role:user?.role ?? null,hasRestaurantId:!!user?.restaurantId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H1',location:'auth.service.ts:114',message:'setRestaurantCtx()',data:{ctxNameTruthy:!!ctx.name,ctxNameLen:ctx.name.length,ctxTypeTruthy:!!ctx.type},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    localStorage.setItem('RestaurantCtx', JSON.stringify(ctx));
  }

  clearRestaurantCtx(): void {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H2',location:'auth.service.ts:122',message:'clearRestaurantCtx()',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H2',location:'auth.service.ts:139',message:'clearUser()',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    this.userSubject.next(null);
    localStorage.removeItem('UserCtx');
  }

  restoreSession(): Observable<UserContextModel | null> {
    const raw = localStorage.getItem('UserCtx');
    if (raw) {
      try {
        const user = JSON.parse(raw) as UserContextModel;
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H3',location:'auth.service.ts:152',message:'restoreSession(): parsed UserCtx',data:{hasRestaurantName:!!user?.restaurantName,restaurantNameLen:(user?.restaurantName?.length ?? 0),role:user?.role ?? null,hasRestaurantId:!!user?.restaurantId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        this.userSubject.next(user);
        localStorage.setItem('UserCtx', JSON.stringify(user));
        this.setRestaurantCtx();
        return of(user);
      } catch {
        console.warn('[AuthService] Failed to parse UserCtx');
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H3',location:'auth.service.ts:160',message:'restoreSession(): parse failed',data:{rawLen:raw.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        this.userSubject.next(null);
        this.clearRestaurantCtx();
        return of(null);
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H3',location:'auth.service.ts:172',message:'restoreSession(): no UserCtx in storage',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    this.userSubject.next(null);
    this.clearRestaurantCtx();
    return of(null);
  }
  // --- Refresh from backend ---

  pingSession(isPublic: boolean = false): Observable<UserContextModel | null> {
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H1',location:'auth.service.ts:182',message:'pingSession(): request',data:{isPublic},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    return this.http.get<UserContextModel>(`${this.apiUrl}/api/user/ping`, { withCredentials: true }).pipe(
      tap(user => {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H1',location:'auth.service.ts:186',message:'pingSession(): success',data:{hasRestaurantName:!!user?.restaurantName,restaurantNameLen:(user?.restaurantName?.length ?? 0),role:user?.role ?? null,hasRestaurantId:!!user?.restaurantId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        this.setUser(user);
      }),
      catchError((error: HttpErrorResponse) => {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H2',location:'auth.service.ts:193',message:'pingSession(): error',data:{status:error.status,isPublic},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
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
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H2',location:'auth.service.ts:214',message:'refreshUserContext(): request',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    return this.http.post<UserContextModel>(`${this.apiUrl}/api/user/refresh-token`, {}, { withCredentials: true }).pipe(
      tap(user => {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H1',location:'auth.service.ts:218',message:'refreshUserContext(): success',data:{hasRestaurantName:!!user?.restaurantName,restaurantNameLen:(user?.restaurantName?.length ?? 0),role:user?.role ?? null,hasRestaurantId:!!user?.restaurantId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        this.setUser(user);
      }),
      catchError(err => {
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e3ccb5'},body:JSON.stringify({sessionId:'e3ccb5',runId:'pre-fix',hypothesisId:'H2',location:'auth.service.ts:223',message:'refreshUserContext(): error',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion agent log
        console.error('Refresh failed', err);
        this.clearUser();
        this.router.navigate(['/login']);
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
