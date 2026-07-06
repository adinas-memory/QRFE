import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Subject } from 'rxjs';
import { OnlineStateService } from './online-state-service';
import { debugLog } from './debug-log.util';

/** Must stay aligned with SSEController KeepAliveLoop delay (seconds) + grace. */
export const SSE_PULSE_INTERVAL_MS = 5_000;
export const SSE_STALE_GRACE_MS = 3_000;
/** Allow one missed pulse before offline (2× interval + grace). */
export const STALE_THRESHOLD_MS = SSE_PULSE_INTERVAL_MS * 2 + SSE_STALE_GRACE_MS;
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
  private debugHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * fetch()-based SSE (fetch-event-source) can go "zombie" on some mobile network transitions:
   * the underlying stream stops yielding data but never fires onerror/close, so streamOpen stays
   * true forever while no pulses arrive. The stale-watch below is the only thing that can detect
   * this (via pulse age) — when it does, force the consumer to abort + recreate the connection
   * instead of just flipping isOnline and passively waiting for the dead stream to notice itself.
   */
  private readonly forceReconnectSubject = new Subject<void>();
  readonly forceReconnect$ = this.forceReconnectSubject.asObservable();

  constructor() {
    this.startStaleWatch();
    if (Capacitor.isNativePlatform()) {
      this.debugHeartbeatTimer = setInterval(() => {
        debugLog('sse', 'sse-connectivity.service.ts:heartbeat', 'js heartbeat', {
          streamOpen: this.streamOpen,
          pulseGapMs: this.lastPulseAt ? Date.now() - this.lastPulseAt : null,
          documentHidden: typeof document !== 'undefined' ? document.hidden : null,
          isOnline: this.onlineState.isOnline,
        });
      }, 3000);
    }
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
    if (_eventType === 'reconnect-check') {
      return;
    }
    const isPulse = _eventType === 'ConnectivityPulse';
    if (isPulse) {
      this.lastPulseAt = Date.now();
      this.lastActivityAt = this.lastPulseAt;
      if (!this.onlineState.isOnline) {
        this.clearOfflineDebounce();
        this.onlineState.setOnlineFromConnectivitySource();
      }
      this.onlineState.notifyConnectivityPulse();
      return;
    }
    this.lastActivityAt = Date.now();
  }

  reportStreamError(isAuth401: boolean): void {
    if (isAuth401 || this.sseReconnecting) {
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
    // Android background: unrelated API calls (lock poll, sync) fail while SSE is still healthy.
    if (this.streamOpen && Capacitor.isNativePlatform()) {
      const pulseAge = this.lastPulseAt > 0 ? Date.now() - this.lastPulseAt : Number.POSITIVE_INFINITY;
      if (pulseAge < STALE_THRESHOLD_MS) {
        return;
      }
    }
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
    debugLog('sse', 'sse-connectivity.service.ts:reportNativeNetworkLost', 'native network lost', {
      streamOpen: this.streamOpen,
      lastPulseAgeMs: this.lastPulseAt ? Date.now() - this.lastPulseAt : null,
    });
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
    if (Capacitor.isNativePlatform()) {
      debugLog('sse', 'sse-connectivity.service.ts:scheduleOffline', 'scheduleOffline invoked', {
        reason,
        streamOpen: this.streamOpen,
        lastPulseAgeMs: this.lastPulseAt ? Date.now() - this.lastPulseAt : null,
        documentHidden: typeof document !== 'undefined' ? document.hidden : null,
      });
    }
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
      const zombieStream = pulseStale && this.streamOpen;
      const stale = !this.streamOpen || pulseStale;
      if (zombieStream) {
        debugLog('sse', 'sse-connectivity.service.ts:scheduleOffline', 'forcing reconnect: zombie stream', {
          reason,
          lastPulseAgeMs: this.lastPulseAt ? Date.now() - this.lastPulseAt : null,
        });
        // fetch-event-source can stall with streamOpen=true and no pulses while HTTP still works.
        // Reconnect SSE directly — do NOT flip offline (avoids heavy-sync + false offline banner).
        this.streamOpen = false;
        this.forceReconnectSubject.next();
        return;
      }
      if (stale || reason === 'http-network' || reason === 'native-network-lost' || reason === 'sse-error') {
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
}
