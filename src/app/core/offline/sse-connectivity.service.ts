import { Injectable, inject } from '@angular/core';
import { OnlineStateService } from './online-state-service';

const STALE_THRESHOLD_MS = 22_000;
const OFFLINE_DEBOUNCE_MS = 2_000;
const FAST_OFFLINE_DEBOUNCE_MS = 500;

@Injectable({ providedIn: 'root' })
export class SseConnectivityService {
  private readonly onlineState = inject(OnlineStateService);

  private lastActivityAt = 0;
  private streamOpen = false;
  private offlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private staleWatchTimer: ReturnType<typeof setInterval> | null = null;
  private bootstrapFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startStaleWatch();
  }

  reportStreamOpened(): void {
    this.streamOpen = true;
    this.lastActivityAt = Date.now();
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
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H2',location:'sse-connectivity.service.ts:reportStreamActivity',message:'ConnectivityPulse received',data:{streamOpen:this.streamOpen,isOnline:this.onlineState.isOnline,lastActivityAgeMs:0},timestamp:Date.now()})}).catch(()=>{});
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

  reportStreamClosed(): void {
    this.streamOpen = false;
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
    void this.onlineState.confirmConnectivity(true);
  }

  reportNativeNetworkLost(): void {
    this.scheduleOffline('native-network-lost');
  }

  /** Ping-lite failed — mark offline immediately and invalidate zombie SSE activity. */
  reportPingFailed(reason: string): void {
    if (this.streamOpen) {
      this.lastActivityAt = 0;
    }
    this.onlineState.setOfflineFromConnectivitySource(reason);
  }

  /**
   * Ping-lite succeeded. Only mark online when SSE is healthy or the stream is not open
   * (bootstrap / reconnect path). Ignores ping when a zombie SSE socket is stale.
   */
  reportPingSuccess(): void {
    const sseStale = this.streamOpen && this.lastActivityAt > 0
      && Date.now() - this.lastActivityAt > STALE_THRESHOLD_MS;
    if (sseStale) {
      // #region agent log
      fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H8',location:'sse-connectivity.service.ts:reportPingSuccess',message:'ping ok ignored — stale SSE',data:{streamOpen:this.streamOpen,lastActivityAgeMs:Date.now()-this.lastActivityAt},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      const stale = !this.streamOpen || Date.now() - this.lastActivityAt > STALE_THRESHOLD_MS;
      if (stale || reason === 'http-network' || reason === 'native-network-lost' || reason === 'sse-error') {
        // #region agent log
        fetch('http://127.0.0.1:7761/ingest/1418246a-67e2-4be2-9f84-77b49dcc9c16',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e48331'},body:JSON.stringify({sessionId:'e48331',hypothesisId:'H1-H3',location:'sse-connectivity.service.ts:scheduleOffline',message:'sse offline scheduled firing',data:{reason,stale,streamOpen:this.streamOpen,lastActivityAgeMs:Date.now()-this.lastActivityAt},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        this.onlineState.setOfflineFromConnectivitySource(reason);
      }
    }, debounceMs);
  }

  private offlineDebounceMsFor(reason: string): number {
    if (reason === 'http-network' || reason === 'native-network-lost') {
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
      if (!this.streamOpen || this.lastActivityAt === 0) {
        return;
      }
      if (Date.now() - this.lastActivityAt > STALE_THRESHOLD_MS) {
        this.scheduleOffline('stale-watch');
      }
    }, 5_000);
  }
}
