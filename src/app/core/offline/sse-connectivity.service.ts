import { Injectable, inject } from '@angular/core';
import { OnlineStateService } from './online-state-service';

/** Must stay aligned with SSEController KeepAliveLoop delay (seconds) + grace. */
export const SSE_PULSE_INTERVAL_MS = 5_000;
export const SSE_STALE_GRACE_MS = 3_000;
export const STALE_THRESHOLD_MS = SSE_PULSE_INTERVAL_MS + SSE_STALE_GRACE_MS;
const STALE_WATCH_INTERVAL_MS = 1_000;
const OFFLINE_DEBOUNCE_MS = 2_000;
const FAST_OFFLINE_DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class SseConnectivityService {
  private readonly onlineState = inject(OnlineStateService);

  private lastActivityAt = 0;
  private lastPulseAt = 0;
  private streamOpen = false;
  private sseReconnecting = false;
  private offlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private staleWatchTimer: ReturnType<typeof setInterval> | null = null;
  private bootstrapFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startStaleWatch();
  }

  /** True when the restaurant SSE stream is open — ping-lite must not drive online/offline. */
  isStreamActive(): boolean {
    return this.streamOpen;
  }

  reportStreamOpened(): void {
    this.sseReconnecting = false;
    this.streamOpen = true;
    this.lastActivityAt = Date.now();
    this.lastPulseAt = this.lastActivityAt;
    this.clearOfflineDebounce();
    this.clearBootstrapFallback();
    this.onlineState.setOnlineFromConnectivitySource();
    this.onlineState.notifyConnectivityPulse();
  }

  reportStreamActivity(_eventType?: string): void {
    if (!this.streamOpen) {
      return;
    }
    this.lastActivityAt = Date.now();
    if (_eventType === 'ConnectivityPulse') {
      this.lastPulseAt = this.lastActivityAt;
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H10-H11',location:'sse-connectivity.service.ts:reportStreamActivity',message:'ConnectivityPulse received',data:{streamOpen:this.streamOpen,isOnline:this.onlineState.isOnline,tabId:this.debugTabId()},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    if (!this.onlineState.isOnline) {
      this.clearOfflineDebounce();
      this.onlineState.setOnlineFromConnectivitySource();
    }
    this.onlineState.notifyConnectivityPulse();
  }

  reportStreamError(isAuth401: boolean): void {
    if (isAuth401) {
      return;
    }
    this.scheduleOffline('sse-error');
  }

  /** Intentional SSE reconnect — do not mark offline until the new stream opens or errors. */
  reportStreamReconnecting(): void {
    this.sseReconnecting = true;
    this.streamOpen = false;
    this.clearOfflineDebounce();
  }

  reportStreamClosed(): void {
    this.streamOpen = false;
    if (this.sseReconnecting) {
      return;
    }
    this.scheduleOffline('sse-closed');
  }

  reportHttpNetworkFailure(): void {
    this.scheduleOffline('http-network');
  }

  /** Fallback when SSE is not yet connected (login, pre-restaurant). */
  scheduleBootstrapConnectivityCheck(delayMs = 3_000): void {
    this.clearBootstrapFallback();
    this.bootstrapFallbackTimer = setTimeout(() => {
      this.bootstrapFallbackTimer = null;
      if (!this.streamOpen && !this.onlineState.isOnline) {
        void this.onlineState.confirmConnectivity(true);
      }
    }, delayMs);
  }

  requestReconnectCheck(): void {
    if (this.streamOpen) {
      this.reportStreamActivity('reconnect-check');
      return;
    }
    void this.onlineState.confirmConnectivity(true);
  }

  reportNativeNetworkAvailable(): void {
    if (this.streamOpen) {
      this.requestReconnectCheck();
      return;
    }
    void this.onlineState.confirmConnectivity(true);
  }

  reportNativeNetworkLost(): void {
    this.scheduleOffline('native-network-lost');
  }

  /** Ping-lite failed — only when SSE is not active (bootstrap / pre-stream). */
  reportPingFailed(reason: string): void {
    if (this.streamOpen) {
      return;
    }
    this.onlineState.setOfflineFromConnectivitySource(reason);
  }

  /** Ping-lite succeeded — only when SSE is not active. */
  reportPingSuccess(): void {
    if (this.streamOpen) {
      return;
    }
    this.onlineState.setOnlineFromConnectivitySource();
  }

  private scheduleOffline(reason: string): void {
    if (this.onlineState.isOnline === false && reason === 'stale-watch') {
      return;
    }
    const debounceMs = this.offlineDebounceMsFor(reason);
    if (this.offlineDebounceTimer !== null) {
      return;
    }
    this.offlineDebounceTimer = setTimeout(() => {
      this.offlineDebounceTimer = null;
      const pulseStale = this.lastPulseAt > 0 && Date.now() - this.lastPulseAt > STALE_THRESHOLD_MS;
      const stale = !this.streamOpen || pulseStale;
      if (stale || reason === 'http-network' || reason === 'native-network-lost' || reason === 'sse-error') {
        // #region agent log
        fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H10-H11',location:'sse-connectivity.service.ts:scheduleOffline',message:'sse offline scheduled firing',data:{reason,stale,streamOpen:this.streamOpen,lastActivityAgeMs:Date.now()-this.lastActivityAt,tabId:this.debugTabId()},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        this.onlineState.setOfflineFromConnectivitySource(reason);
      }
    }, debounceMs);
  }

  private offlineDebounceMsFor(reason: string): number {
    if (reason === 'http-network' || reason === 'native-network-lost' || reason === 'stale-watch') {
      return 0;
    }
    if (reason === 'sse-error' || reason === 'sse-closed') {
      return FAST_OFFLINE_DEBOUNCE_MS;
    }
    return OFFLINE_DEBOUNCE_MS;
  }

  private clearOfflineDebounce(): void {
    if (this.offlineDebounceTimer !== null) {
      clearTimeout(this.offlineDebounceTimer);
      this.offlineDebounceTimer = null;
    }
  }

  private clearBootstrapFallback(): void {
    if (this.bootstrapFallbackTimer !== null) {
      clearTimeout(this.bootstrapFallbackTimer);
      this.bootstrapFallbackTimer = null;
    }
  }

  private startStaleWatch(): void {
    if (this.staleWatchTimer !== null) {
      return;
    }
    this.staleWatchTimer = setInterval(() => {
      if (!this.streamOpen || this.lastPulseAt === 0) {
        return;
      }
      if (Date.now() - this.lastPulseAt > STALE_THRESHOLD_MS) {
        this.scheduleOffline('stale-watch');
      }
    }, STALE_WATCH_INTERVAL_MS);
  }

  private debugTabId(): string {
    if (typeof sessionStorage === 'undefined') {
      return 'unknown';
    }
    const key = 'debugTabId';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `tab-${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }
}
