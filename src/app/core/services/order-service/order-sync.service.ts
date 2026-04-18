// order-sync.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, timer } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source';
import { environment } from '../../../../environments/environment';
import { SseEvent } from '../../models/sseModel';
import { AuthService } from '../../auth/auth.service';
import { OfflineQueueProcessor } from '../../offline/offline-queue-processor.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';
import { firstValueFrom } from 'rxjs';

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
  private watermarkSequence = 0;

  // event stream
  private eventsSubject = new Subject<SseEvent<any>>();
  public events$ = this.eventsSubject.asObservable();

  // optional buffering while reconnecting
  private bufferWhileReconnecting = true;
  private eventBuffer: SseEvent<any>[] = [];
  private maxBufferSize = 200;

  constructor(private auth: AuthService,
    private ngZone: NgZone,
    private queueProcessor: OfflineQueueProcessor,
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

    // If app was loaded in a background tab, we might skip SSE open.
    // When the tab becomes visible, (re)open SSE if needed.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const rid = this.pendingOpenRestaurantId ?? this.lastRestaurantId;
        if (rid && !this.controller) {
          this.openConnection(rid);
        }
      }
    });
  }

  async trySyncNow() {
    if (this.syncInProgress) return;
    if (!this.onlineStateService.isOnline) return;
    this.syncInProgress = true;

    try {
      const actions = await this.offlineDB.getPendingActions();

      for (const action of actions) {
        try {
          await this.queueProcessor.processAction(action);
          if (!action.id) return console.warn('[SYNC] Action has no ID, cannot mark done:', action);
          await this.offlineDB.markActionDone(action.id);
        } catch (err) {
          console.warn('[SYNC] Action failed, will retry later:', action, err);
          this.onlineStateService.setOffline();
          break; // ne oprim, nu stricăm ordinea
        }
      }

    } finally {
      this.syncInProgress = false;
    }
  }


  listenToRestaurantEvents<T = any>(restaurantId: string): Observable<SseEvent<T>> {
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

  private openConnection(restaurantId: string) {
    // already connected to the same restaurant
    if (this.controller && this.connectedRestaurantId === restaurantId) {
      return;
    }
    if (document.hidden) {
      this.pendingOpenRestaurantId = restaurantId;
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
          throw new Error(`SSE subscribe failed: HTTP ${response.status}`);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType?.startsWith(EventStreamContentType)) {
          throw new Error(`SSE expected ${EventStreamContentType}, got: ${contentType ?? 'none'}`);
        }
        this.onlineStateService.setOnline();

        // Hybrid reconnect: apply authoritative snapshot + watermark
        try {
          await this.syncRestaurantState(restaurantId);
        } catch (e) {
          console.warn('[SSE][internal] /api/sync failed (continuing live SSE only)', e);
        }

        this.ngZone.run(() => {
          this.reconnectAttempts = 0;
        });
        this.queueProcessor.processQueue();
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
        this.onlineStateService.setOffline();
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
    const res = await fetch(url, { method: 'GET', credentials: 'include' });
    if (!res.ok) throw new Error(`Sync failed: HTTP ${res.status}`);
    const json = await res.json() as any;

    // ASP.NET typically serializes to camelCase by default (restaurantId/tables/watermark).
    // Accept both PascalCase and camelCase to avoid "empty snapshot" bugs.
    const watermark = json?.Watermark ?? json?.watermark;
    const seq = watermark?.Sequence ?? watermark?.sequence ?? 0;
    if (typeof seq === 'number' && seq > this.watermarkSequence) {
      this.watermarkSequence = seq;
    }

    const tables = (json?.Tables ?? json?.tables ?? []) as any[];
    await this.offlineDB.applySyncSnapshot(tables as any);
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
    if (document.hidden) {
      return;
    }
    // If already refreshing, do nothing (we'll reconnect after refresh completes)
    if (this.isRefreshing) return;

    // Try to refresh session once, serialized
    this.isRefreshing = true;

    this.auth.refreshUserContext().pipe(
      take(1),
      catchError(e => {
        console.error('[OrderSync] refreshUserContext failed', e);
        return of(null);
      })
    ).subscribe(user => {
      this.isRefreshing = false;

      if (user) {
        // refresh OK -> reopen connection (reset reconnect attempts)
        this.reconnectAttempts = 0;
        // small delay to allow cookies/session to settle
        setTimeout(() => {
          this.openConnection(restaurantId);
          // flush any buffered events after connection established
          // note: openConnection resets reconnectAttempts in onopen
          setTimeout(() => this.flushBuffer(), 300);
        }, 300);
        return;
      }

      // refresh failed -> try limited reconnects (backoff) or force logout
      this.reconnectAttempts++;
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        const delay = Math.min(30000, this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1));
        console.warn(`[OrderSync] refresh failed, scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        timer(delay).pipe(take(1)).subscribe(() => {
          if (document.hidden) {
            return;
          }
          // attempt to reopen; this will again trigger refresh flow if needed
          this.openConnection(restaurantId);
        });
      } else {
        // give up: clear session and emit an error event so app can redirect to login
        console.error('[OrderSync] max reconnect attempts reached, clearing session');
        this.close();
        this.auth.clearUser();
        // emit a special event so components can react (optional)
        this.eventsSubject.next({ EventType: 'SSE_AUTH_FAILED', Data: null, Sequence: 0, RestaurantId: restaurantId, InitiatedBy: 'system' });
      }
    });
  }
}
