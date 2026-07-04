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
    this.onlineState.pingOk$?.subscribe(() => {
      this.lastActivityAt = Date.now();
      this.clearOfflineDebounce();
    });
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
    this.lastActivityAt = Date.now();
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

  private scheduleOffline(reason: string): void {
    const debounceMs = this.offlineDebounceMsFor(reason);
    if (this.offlineDebounceTimer !== null) {
      return;
    }
    this.offlineDebounceTimer = setTimeout(() => {
      this.offlineDebounceTimer = null;
      const stale = !this.streamOpen || Date.now() - this.lastActivityAt > STALE_THRESHOLD_MS;
      if (stale || reason === 'http-network' || reason === 'native-network-lost' || reason === 'sse-error') {
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
