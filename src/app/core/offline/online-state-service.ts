import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OnlineStateService {
  private _isOnline = true;
  get isOnline() { return this._isOnline; }
  private apiUrl = environment.apiUrl;

  // ← skip(1) pentru a nu emite la startup
  private onlineSubject = new BehaviorSubject<boolean>(true);
  readonly online$ = this.onlineSubject.asObservable();

  private lastHeartbeat = 0;
  private readonly heartbeatInterval = 10000;
  private heartbeatInProgress: Promise<void> | null = null;

  constructor() {
    this.startHeartbeat();

    window.addEventListener('online', () => {
      // Nu pornim fetch dacă unul e deja în curs
      this.runHeartbeat(true);
    });

    window.addEventListener('offline', () => {
      // Confirm with ping-lite before showing offline banner (browser "offline" is often wrong on LAN).
      this.runHeartbeat(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.runHeartbeat(true);
    });
  }

  private startHeartbeat() {
    setInterval(() => this.runHeartbeat(), this.heartbeatInterval);
  }

  private async runHeartbeat(force = false) {
    const now = Date.now();

    if (!force) {
      if (now - this.lastHeartbeat < this.heartbeatInterval) return;
    }

    // ← Crucial: indiferent de force, nu pornim un al doilea fetch
    if (this.heartbeatInProgress) {
      return;
    }

    this.heartbeatInProgress = (async () => {
      try {
        const hasAbortTimeout =
          typeof AbortSignal !== 'undefined' &&
          typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === 'function';

        const res = await fetch(`${this.apiUrl}/api/ping-lite`, {
          method: 'GET',
          cache: 'no-store',
          ...(hasAbortTimeout ? { signal: AbortSignal.timeout(8000) } : {}),
        });
        if (res.ok || res.status < 500) {
          this.setOnline();
        } else {
          this.setOffline();
        }
      } catch {
        this.setOffline();
      } finally {
        this.lastHeartbeat = Date.now();
        this.heartbeatInProgress = null;
      }
    })();
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
