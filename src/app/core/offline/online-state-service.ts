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

        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-heartbeat',hypothesisId:'H-ABORT',location:'online-state-service.ts:heartbeat',message:'heartbeat start',data:{apiUrl:this.apiUrl,force,hasAbortTimeout},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

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
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'lan-heartbeat',hypothesisId:'H-ABORT',location:'online-state-service.ts:heartbeat',message:'heartbeat threw',data:{apiUrl:this.apiUrl},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
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
