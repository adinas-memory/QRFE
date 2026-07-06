import { Injectable, inject, Injector } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SseConnectivityService } from './sse-connectivity.service';

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.() === true
  );
}

@Injectable({ providedIn: 'root' })
export class OnlineStateService {
  private readonly injector = inject(Injector);
  private _isOnline = true;
  get isOnline() { return this._isOnline; }
  private apiUrl = environment.apiUrl;

  private onlineSubject = new BehaviorSubject<boolean>(true);
  readonly online$ = this.onlineSubject.asObservable();

  private resumeConnectivitySubject = new Subject<void>();
  /** After connectivity confirmed on resume (tab visible / app foreground). */
  readonly resumeConnectivityOk$ = this.resumeConnectivitySubject.asObservable();

  private readonly pingOkSubject = new Subject<void>();
  /** Emits when connectivity is confirmed (SSE pulse or bootstrap ping-lite). */
  readonly pingOk$ = this.pingOkSubject.asObservable();

  private heartbeatInProgress: Promise<boolean> | null = null;

  private resumeCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resumeCheckDebounceMs = 300;
  private lastResumePipelineAt = 0;
  private readonly resumePipelineCooldownMs = 3000;
  private lastForcedPingAt = 0;
  private readonly forcedPingMinIntervalMs = 2000;
  private resumeCheckInProgress = false;
  private supplementalHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Fast offline/online detection alongside SSE pulse (max ~10s when API stops). */
  private readonly supplementalHeartbeatMs = 10_000;

  constructor() {
    window.addEventListener('online', () => {
      void this.confirmConnectivity(true);
    });

    window.addEventListener('offline', () => {
      void this.confirmConnectivity(true);
    });

    if (!isCapacitorNative()) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.triggerResumeCheck();
        }
      });
    }

    this.startSupplementalHeartbeat();
  }

  private startSupplementalHeartbeat(): void {
    if (this.supplementalHeartbeatTimer !== null) {
      return;
    }
    this.supplementalHeartbeatTimer = setInterval(() => {
      if (this.injector.get(SseConnectivityService).isStreamActive()) {
        return;
      }
      void this.confirmConnectivity(false);
    }, this.supplementalHeartbeatMs);
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
    const now = Date.now();
    if (now - this.lastResumePipelineAt < this.resumePipelineCooldownMs) {
      return;
    }
    if (this.resumeCheckInProgress) {
      return;
    }

    this.resumeCheckInProgress = true;
    this.lastResumePipelineAt = now;

    try {
      const ok = await this.confirmConnectivity(true);
      if (!ok) {
        return;
      }
      this.resumeConnectivitySubject.next();
    } finally {
      this.resumeCheckInProgress = false;
    }
  }

  /** Bootstrap ping-lite before SSE is connected. Returns true when server responds OK. */
  async confirmConnectivity(force = false): Promise<boolean> {
    const now = Date.now();

    if (force && now - this.lastForcedPingAt < this.forcedPingMinIntervalMs) {
      return this._isOnline;
    }

    if (this.heartbeatInProgress) {
      return this.heartbeatInProgress;
    }

    if (force) {
      this.lastForcedPingAt = now;
    }

    this.heartbeatInProgress = this.executePing();
    return this.heartbeatInProgress;
  }

    private async executePing(): Promise<boolean> {
    const pingUrl = `${this.apiUrl}/api/ping-lite`;
    const pageProtocol = typeof window !== 'undefined' ? window.location.protocol : 'n/a';
    // #region agent log
    const debugPayload = { sessionId: 'e48331', location: 'online-state-service.ts:executePing:start', message: 'ping-lite start', data: { pingUrl, apiUrl: this.apiUrl, pageProtocol, isOnlineBefore: this._isOnline }, timestamp: Date.now(), hypothesisId: 'I' };
    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(debugPayload) }).catch(() => {});
    fetch('http://192.168.43.142:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(debugPayload) }).catch(() => {});
    try { localStorage.setItem('qrfe-debug-last-ping', JSON.stringify(debugPayload)); } catch { /* ignore */ }
    // #endregion
    try {
      const hasAbortTimeout =
        typeof AbortSignal !== 'undefined' &&
        typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === 'function';

      const res = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-store',
        ...(hasAbortTimeout ? { signal: AbortSignal.timeout(8000) } : {}),
      });
      const ok = res.ok || res.status < 500;
      // #region agent log
      const resultPayload = { sessionId: 'e48331', location: 'online-state-service.ts:executePing:result', message: 'ping-lite response', data: { pingUrl, status: res.status, ok, pageProtocol }, timestamp: Date.now(), hypothesisId: 'I' };
      fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(resultPayload) }).catch(() => {});
      fetch('http://192.168.43.142:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(resultPayload) }).catch(() => {});
      try { localStorage.setItem('qrfe-debug-last-ping', JSON.stringify(resultPayload)); } catch { /* ignore */ }
      // #endregion
      const sseConnectivity = this.injector.get(SseConnectivityService);
      if (sseConnectivity.isStreamActive()) {
        return ok;
      }
      if (ok) {
        this.notifyConnectivityPulse();
        sseConnectivity.reportPingSuccess();
      } else {
        sseConnectivity.reportPingFailed('ping-lite-fail');
      }
      return ok;
    } catch (err) {
      // #region agent log
      const errPayload = { sessionId: 'e48331', location: 'online-state-service.ts:executePing:error', message: 'ping-lite failed', data: { pingUrl, pageProtocol, error: String(err) }, timestamp: Date.now(), hypothesisId: 'I' };
      fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(errPayload) }).catch(() => {});
      fetch('http://192.168.43.142:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e48331' }, body: JSON.stringify(errPayload) }).catch(() => {});
      try { localStorage.setItem('qrfe-debug-last-ping', JSON.stringify(errPayload)); } catch { /* ignore */ }
      // #endregion
      const sseConnectivity = this.injector.get(SseConnectivityService);
      if (!sseConnectivity.isStreamActive()) {
        sseConnectivity.reportPingFailed('ping-lite-error');
      }
      return false;
    } finally {
      this.heartbeatInProgress = null;
    }
  }

  notifyConnectivityPulse(): void {
    this.pingOkSubject.next();
  }

  setOfflineFromConnectivitySource(reason?: string): void {
    this.setOffline();
  }

  setOnlineFromConnectivitySource(): void {
    this.setOnline();
  }

  setOffline(): void {
    if (!this._isOnline) return;
    this._isOnline = false;
    this.onlineSubject.next(false);
  }

  setOnline(): void {
    if (this._isOnline) return;
    this._isOnline = true;
    this.onlineSubject.next(true);
  }
}
