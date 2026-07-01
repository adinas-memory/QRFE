// order-sync.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, of, timer, firstValueFrom } from 'rxjs';
import { take, catchError, filter, map } from 'rxjs/operators';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';
import { environment } from '../../../../environments/environment';
import { SseEvent } from '../../models/sseModel';
import { AuthService } from '../../auth/auth.service';
import { isAssignedRestaurantId } from '../../auth/restaurant-id.util';
import { OfflineQueueProcessor } from '../../offline/offline-queue-processor.service';
import { OfflineSyncSchedulerService } from '../../offline/offline-sync-scheduler.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class OrderSyncService {
  private apiUrl = environment.apiUrl;
  private controller: AbortController | null = null;
  private lastRestaurantId: string | null = null;
  private pendingOpenRestaurantId: string | null = null;
  private connectedRestaurantId: string | null = null;
  private readonly tabId = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  /**
   * Same-browser only: Edge tabs share with Edge; Chrome with Chrome.
   * Cross-browser delivery relies on each browser having its own live SSE connection to the API.
   */
  private readonly bc: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qrfe-internal-sse') : null;

  // reconnect / refresh control
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private baseReconnectDelayMs = 1000;
  private isRefreshing = false;
  private syncInProgress = false;
  private snapshotRefreshInProgress = false;
  private lastSnapshotRefreshAt = 0;
  private readonly snapshotRefreshMinIntervalMs = 3000;
  private watermarkSequence = 0;

  // event stream
  private eventsSubject = new Subject<SseEvent<any>>();
  public events$ = this.eventsSubject.asObservable();

  private snapshotRefreshedSubject = new Subject<{ restaurantId: string; activeGuestWaiterCalls: string[] }>();
  /** Emitted after /api/sync snapshot is applied to Dexie (resume, SSE reconnect, etc.). */
  readonly snapshotRefreshed$ = this.snapshotRefreshedSubject.asObservable();

  // optional buffering while reconnecting
  private bufferWhileReconnecting = true;
  private eventBuffer: SseEvent<any>[] = [];
  private maxBufferSize = 200;

  private toSseHttpError(status: number, wwwAuthenticate: string | null): Error & { status: number; wwwAuthenticate?: string } {
    const e = new Error(`SSE subscribe failed: HTTP ${status}`) as Error & { status: number; wwwAuthenticate?: string };
    e.status = status;
    if (wwwAuthenticate) e.wwwAuthenticate = wwwAuthenticate;
    return e;
  }

  constructor(private auth: AuthService,
    private ngZone: NgZone,
    private queueProcessor: OfflineQueueProcessor,
    private syncScheduler: OfflineSyncSchedulerService,
    private offlineDB: OfflineDbService,
    private onlineStateService: OnlineStateService    
  ) {
    // Cross-tab fanout: if one tab receives SSE, share it to others.
    this.bc?.addEventListener('message', (ev: MessageEvent) => {
      const msg = ev.data as { sourceTabId?: string; sse?: SseEvent<any> } | null;
      const sse = msg?.sse;
      if (!sse) return;
      if (msg?.sourceTabId && msg.sourceTabId === this.tabId) return; // ignore own echoes
      this.ngZone.run(() => {
        this.eventsSubject.next(sse);
      });
    });

    this.onlineStateService.resumeConnectivityOk$
      .subscribe(() => {
        void this.refreshRestaurantSnapshot({ fromResume: true });
        this.flushPendingSseConnection();
      });

    if (!Capacitor.isNativePlatform()) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.flushPendingSseConnection();
        }
      });
    }

    this.onlineStateService.online$
      .pipe(filter(isOnline => isOnline))
      .subscribe(() => {
        const rid = this.resolveRestaurantId();
        if (!rid) return;
        if (!this.controller) {
          this.reconnectAttempts = 0;
          this.openConnection(rid);
        } else {
          void this.refreshRestaurantSnapshot();
        }
      });
  }

  private resolveRestaurantId(): string | null {
    if (this.lastRestaurantId && isAssignedRestaurantId(this.lastRestaurantId)) {
      return this.lastRestaurantId;
    }
    const fromAuth = this.auth.getUserRestaurantId();
    return typeof fromAuth === 'string' && isAssignedRestaurantId(fromAuth) ? fromAuth : null;
  }

  async trySyncNow() {
    if (this.syncInProgress) return;
    if (!this.onlineStateService.isOnline) return;
    this.syncInProgress = true;

    try {
      // #region agent log
      fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd38222' },
        body: JSON.stringify({
          sessionId: 'd38222',
          location: 'order-sync.service.ts:trySyncNow',
          message: 'delegating to processQueue (no parallel processAction loop)',
          data: {},
          hypothesisId: 'H5-trysync-race',
          runId: 'post-fix-v2',
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      await this.syncScheduler.runWhenAllowed();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Pull authoritative restaurant snapshot from GET /api/sync and apply to Dexie.
   * Used when returning from background where SSE events may have been missed.
   */
  async refreshRestaurantSnapshot(options?: { fromResume?: boolean; force?: boolean }): Promise<boolean> {
    const restaurantId = this.resolveRestaurantId();
    if (!restaurantId) {
      return false;
    }
    if (!options?.fromResume && !this.onlineStateService.isOnline) {
      return false;
    }
    const now = Date.now();
    if (!options?.force && now - this.lastSnapshotRefreshAt < this.snapshotRefreshMinIntervalMs) {
      return false;
    }
    if (this.snapshotRefreshInProgress) {
      return false;
    }

    this.snapshotRefreshInProgress = true;
    let succeeded = false;
    try {
      await this.trySyncNow();
      await this.syncRestaurantState(restaurantId);
      if (!this.controller) {
        this.openConnection(restaurantId);
      }
      succeeded = true;
      return true;
    } catch (e) {
      console.warn('[OrderSync] refreshRestaurantSnapshot failed', e);
      return false;
    } finally {
      this.snapshotRefreshInProgress = false;
      if (succeeded) {
        this.lastSnapshotRefreshAt = Date.now();
      }
    }
  }


  listenToRestaurantEvents<T = any>(restaurantId: string): Observable<SseEvent<T>> {
    if (!isAssignedRestaurantId(restaurantId)) {
      return this.events$ as Observable<SseEvent<T>>;
    }
    // start connection immediately
    this.lastRestaurantId = restaurantId;
    this.openConnection(restaurantId);
    return this.events$ as Observable<SseEvent<T>>;
  }

  close() {
    try {
      console.warn('[SSE][internal] close() called');
      this.controller?.abort();
    } catch { /* ignore */ }
    this.controller = null;
    this.connectedRestaurantId = null;
    this.eventBuffer = [];
  }

  /** PWA tabs defer SSE while hidden; native keeps the stream alive for instant pickup alerts. */
  private deferSseWhileHidden(): boolean {
    if (Capacitor.isNativePlatform()) {
      return false;
    }
    return document.hidden;
  }

  private flushPendingSseConnection(): void {
    const rid = this.pendingOpenRestaurantId ?? this.resolveRestaurantId();
    if (!rid || this.controller) {
      return;
    }
    this.openConnection(rid);
  }

  private openConnection(restaurantId: string) {
    // already connected to the same restaurant
    if (this.controller && this.connectedRestaurantId === restaurantId) {
      return;
    }
    if (this.deferSseWhileHidden()) {
      this.pendingOpenRestaurantId = restaurantId;
      return;
    }
    if (!this.onlineStateService.isOnline) {
      this.pendingOpenRestaurantId = restaurantId;
      this.lastRestaurantId = restaurantId;
      return;
    }
    this.pendingOpenRestaurantId = null;
    // ensure single controller/connection (switching restaurants)
    if (this.controller) this.close();
    this.controller = new AbortController();
    this.connectedRestaurantId = restaurantId;

    const url = `${this.apiUrl.replace(/\/$/, '')}/sse/internal/restaurant/${restaurantId}`;

    // reset reconnect attempts on manual open
    // (we'll increment on failures)
    // Note: fetchEventSource will keep the connection open until aborted or network error
    fetchEventSource(url, {
      method: 'GET',
      credentials: 'include',
      signal: this.controller.signal,
      /**
       * Default library behaviour aborts SSE while the document is hidden, which drops events
       * with no backfill — bad for Kitchen/Bar when another browser places orders or the tab
       * is in the background. Keep the stream alive whenever possible.
       */
      openWhenHidden: true,
      onopen: async (response) => {
        if (!response.ok) {
          const www = response.headers.get('www-authenticate');
          throw this.toSseHttpError(response.status, www);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith(EventStreamContentType)) {
          throw new Error(`SSE expected ${EventStreamContentType}, got: ${contentType ?? 'none'}`);
        }
        this.onlineStateService.setOnline();

        if (Date.now() - this.lastSnapshotRefreshAt >= this.snapshotRefreshMinIntervalMs) {
          try {
            await this.syncRestaurantState(restaurantId);
          } catch (e) {
            console.warn('[SSE][internal] /api/sync failed (continuing live SSE only)', e);
          }
        }

        this.ngZone.run(() => {
          this.reconnectAttempts = 0;
        });
        void this.syncScheduler.runWhenAllowed();
      },
      onmessage: (msg) => {
        this.ngZone.run(() => {
          // msg.event comes from SSE "event:" field (if server sets it)
          // msg.data is the SSE "data:" payload (string)
          let raw: any;
          try {
            raw = JSON.parse(msg.data);
          } catch {
            raw = msg.data;
          }

          const EventType = msg.event || raw?.EventType || raw?.event || raw?.type || '';

          // support both envelopes:
          // A) { EventType, Data, Sequence, RestaurantId, InitiatedBy }
          // B) payload-only (no wrapper) -> treat raw as Data
          let Data: any = raw?.Data ?? raw?.data ?? raw;
          if (typeof Data === 'string') {
            try { Data = JSON.parse(Data); } catch { /* keep string */ }
          }

          const Sequence = raw?.Sequence ?? raw?.sequence ?? 0;
          const RestaurantId =
            raw?.RestaurantId ??
            raw?.restaurantId ??
            Data?.RestaurantId ??
            Data?.restaurantId ??
            restaurantId;
          const InitiatedBy = raw?.InitiatedBy ?? raw?.initiatedBy ?? 'unknown';

          // ignore "empty" keepalive-like messages
          if (!EventType && (typeof msg.data === 'string') && msg.data.trim() === '') return;

          const sse: SseEvent<any> = { EventType, Data, Sequence, RestaurantId, InitiatedBy };

          if (Sequence && Sequence <= this.watermarkSequence) {
            // already included in last /api/sync snapshot or previously applied
            return;
          }

          if (this.isRefreshing && this.bufferWhileReconnecting) {
            this.bufferEvent(sse);
          } else {
            this.eventsSubject.next(sse);
          }

          // also broadcast to other tabs (best-effort)
          try {
            this.bc?.postMessage({ sourceTabId: this.tabId, sse });
          } catch {
            // ignore
          }
        });
      },
      onerror: (err) => {
        // fetchEventSource calls onerror on network/auth issues
        console.error('[SSE][internal] error', err);
        const status = (err as { status?: number })?.status;
        const msg = String((err as Error)?.message ?? '');
        const isAuth401 = status === 401 || msg.includes('HTTP 401') || msg.includes('invalid_token');

        // 401 (expired token) is NOT "offline". Let refresh flow handle it.
        if (!isAuth401) {
          this.onlineStateService.setOffline();
        }
        this.ngZone.run(() => {
          // if server sends a specific auth error payload, you can detect it here
          // fallback: treat any error as potential auth issue and try refresh
          this.handleSseError(restaurantId, err);
        });
      },
      // optional: onclose not provided by fetchEventSource; errors will be routed to onerror
    }).catch(err => {
      // fetchEventSource may reject on abort or fatal errors
      this.ngZone.run(() => this.handleSseError(restaurantId, err));
    });
  }

  private async syncRestaurantState(restaurantId: string): Promise<void> {
    const url = `${this.apiUrl.replace(/\/$/, '')}/api/sync?restaurantId=${encodeURIComponent(restaurantId)}`;
    let lastError: unknown;
    let refreshedAfter401 = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        if (res.status === 401) {
          if (!refreshedAfter401 && this.onlineStateService.isOnline) {
            refreshedAfter401 = true;
            const refreshed = await this.ensureFreshSession();
            if (refreshed) {
              continue;
            }
          }
          throw new Error('Sync failed: HTTP 401');
        }
        if (!res.ok) {
          throw new Error(`Sync failed: HTTP ${res.status}`);
        }

        const json = await res.json() as any;

        const watermark = json?.Watermark ?? json?.watermark;
        const seq = watermark?.Sequence ?? watermark?.sequence ?? 0;
        if (typeof seq === 'number' && seq > this.watermarkSequence) {
          this.watermarkSequence = seq;
        }

        const tables = (json?.Tables ?? json?.tables ?? []) as any[];
        const activeGuestWaiterCalls = this.parseActiveGuestWaiterCalls(json);
        await this.offlineDB.applySyncSnapshot(tables as any);
        this.lastSnapshotRefreshAt = Date.now();
        this.ngZone.run(() => {
          this.snapshotRefreshedSubject.next({ restaurantId, activeGuestWaiterCalls });
        });
        return;
      } catch (e) {
        lastError = e;
        const is401 = e instanceof Error && e.message.includes('HTTP 401');
        if (is401) {
          break;
        }
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }
    throw lastError;
  }

  private parseActiveGuestWaiterCalls(json: Record<string, unknown>): string[] {
    const raw =
      (json['ActiveGuestWaiterCalls'] as unknown) ??
      (json['activeGuestWaiterCalls'] as unknown);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map(v => String(v ?? '').trim())
      .filter(Boolean);
  }

  /** Renew access cookie via refresh-token; shared by /api/sync and SSE reconnect. */
  private async ensureFreshSession(): Promise<boolean> {
    if (!this.onlineStateService.isOnline) {
      return false;
    }
    const user = await firstValueFrom(
      this.auth.refreshUserContext({ redirectOnFailure: false }).pipe(
        catchError(err => {
          console.error('[OrderSync] refreshUserContext failed', err);
          return of(null);
        }),
        map(u => u ?? null),
      ),
    );
    return user != null;
  }

  private bufferEvent(ev: SseEvent<any>) {
    if (this.eventBuffer.length >= this.maxBufferSize) this.eventBuffer.shift();
    this.eventBuffer.push(ev);
  }

  private flushBuffer() {
    if (!this.bufferWhileReconnecting) return;
    while (this.eventBuffer.length) {
      const ev = this.eventBuffer.shift()!;
      this.eventsSubject.next(ev);
    }
  }

  private handleSseError(restaurantId: string, err: any) {
    if (this.deferSseWhileHidden()) {
      this.pendingOpenRestaurantId = restaurantId;
      return;
    }
    if (this.isRefreshing) return;

    if (!this.onlineStateService.isOnline) {
      this.scheduleSseReconnect(restaurantId);
      return;
    }

    // Try to refresh session once, serialized (only when online)
    this.isRefreshing = true;

    void this.ensureFreshSession().then(refreshed => {
      this.isRefreshing = false;

      if (refreshed) {
        // refresh OK -> reopen connection (reset reconnect attempts)
        this.reconnectAttempts = 0;
        // small delay to allow cookies/session to settle
        setTimeout(() => {
          this.openConnection(restaurantId);
          // flush any buffered events after connection established
          // note: openConnection resets reconnectAttempts to onopen
          setTimeout(() => this.flushBuffer(), 300);
        }, 300);
        return;
      }

      // refresh failed without clearing session (network/transient) -> backoff reconnect
      if (this.auth.isAuthenticated()) {
        this.scheduleSseReconnect(restaurantId);
        return;
      }

      // Real auth failure — refreshUserContext already cleared session
      this.close();
      this.eventsSubject.next({ EventType: 'SSE_AUTH_FAILED', Data: null, Sequence: 0, RestaurantId: restaurantId, InitiatedBy: 'system' });
    });
  }

  private scheduleSseReconnect(restaurantId: string) {
    this.reconnectAttempts++;
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = Math.min(30000, this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1));
      console.warn(`[OrderSync] scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      timer(delay).pipe(take(1)).subscribe(() => {
        if (this.deferSseWhileHidden()) {
          this.pendingOpenRestaurantId = restaurantId;
          return;
        }
        if (!this.onlineStateService.isOnline) {
          return;
        }
        this.openConnection(restaurantId);
      });
    } else {
      console.warn('[OrderSync] max reconnect attempts reached, waiting for online');
      this.close();
      this.reconnectAttempts = 0;
    }
  }
}
