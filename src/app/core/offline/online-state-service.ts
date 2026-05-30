import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OnlineStateService {
  private _isOnline = true;
  get isOnline() { return this._isOnline; }
  private apiUrl = environment.apiUrl;

  private onlineSubject = new BehaviorSubject<boolean>(true);
  readonly online$ = this.onlineSubject.asObservable();

  private resumeConnectivitySubject = new Subject<void>();
  /** After forced ping-lite succeeds on resume (tab visible / app foreground). */
  readonly resumeConnectivityOk$ = this.resumeConnectivitySubject.asObservable();

  private lastHeartbeat = 0;
  private readonly heartbeatInterval = 10000;
  private heartbeatInProgress: Promise<boolean> | null = null;

  private resumeCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resumeCheckDebounceMs = 300;

  constructor() {
    this.startHeartbeat();

    window.addEventListener('online', () => {
      void this.runHeartbeat(true);
    });

    window.addEventListener('offline', () => {
      // Confirm with ping-lite before showing offline banner (browser "offline" is often wrong on LAN).
      void this.runHeartbeat(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.triggerResumeCheck();
      }
    });
  }

  /** Debounced resume entry (PWA Alt+Tab, Capacitor appStateChange). */
  triggerResumeCheck(): void {
    if (this.resumeCheckTimer) {
      clearTimeout(this.resumeCheckTimer);
    }
    this.resumeCheckTimer = setTimeout(() => {
      this.resumeCheckTimer = null;
      void this.runResumeCheck();
    }, this.resumeCheckDebounceMs);
  }

  private async runResumeCheck(): Promise<void> {
    const ok = await this.confirmConnectivity(true);
    if (ok) {
      this.resumeConnectivitySubject.next();
    }
  }

  private startHeartbeat() {
    setInterval(() => void this.runHeartbeat(), this.heartbeatInterval);
  }

  private async runHeartbeat(force = false): Promise<boolean> {
    return this.confirmConnectivity(force);
  }

  /** Ping-lite; updates isOnline. Returns true when server responds OK. */
  async confirmConnectivity(force = false): Promise<boolean> {
    const now = Date.now();

    if (!force) {
      if (now - this.lastHeartbeat < this.heartbeatInterval) {
        return this._isOnline;
      }
    }

    if (this.heartbeatInProgress) {
      return this.heartbeatInProgress;
    }

    this.heartbeatInProgress = this.executePing();
    return this.heartbeatInProgress;
  }

  private async executePing(): Promise<boolean> {
    try {
      const hasAbortTimeout =
        typeof AbortSignal !== 'undefined' &&
        typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === 'function';

      const res = await fetch(`${this.apiUrl}/api/ping-lite`, {
        method: 'GET',
        cache: 'no-store',
        ...(hasAbortTimeout ? { signal: AbortSignal.timeout(8000) } : {}),
      });
      const ok = res.ok || res.status < 500;
      if (ok) {
        this.setOnline();
      } else {
        this.setOffline();
      }
      return ok;
    } catch {
      this.setOffline();
      return false;
    } finally {
      this.lastHeartbeat = Date.now();
      this.heartbeatInProgress = null;
    }
  }

  setOffline() {
    if (!this._isOnline) return;
    this._isOnline = false;
    this.onlineSubject.next(false);
  }

  setOnline() {
    if (this._isOnline) return;
    this._isOnline = true;
    this.onlineSubject.next(true);
  }
}
