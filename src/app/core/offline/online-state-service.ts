import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class OnlineStateService {
  private _isOnline = true;
  get isOnline() { return this._isOnline; }
  private apiUrl = environment.apiUrl;
  private onlineSubject = new BehaviorSubject<boolean>(true);
  readonly online$ = this.onlineSubject.asObservable();

  private lastHeartbeat = 0;
  private readonly heartbeatInterval = 10000;
  private heartbeatInProgress: Promise<void> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    setInterval(() => this.runHeartbeat(), this.heartbeatInterval);
  }

  private async runHeartbeat() {
    const now = Date.now();
    if (now - this.lastHeartbeat < this.heartbeatInterval) return;
    if (this.heartbeatInProgress) return;

    this.heartbeatInProgress = (async () => {
      try {
        await fetch(`${this.apiUrl}/api/ping-lite`, { method: 'HEAD', credentials: 'include' });
        this.setOnline();
      } catch {
        this.setOffline();
      }
      this.lastHeartbeat = Date.now();
      this.heartbeatInProgress = null;
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
