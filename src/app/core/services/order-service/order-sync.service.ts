// order-sync.service.ts
import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, BehaviorSubject, of, timer } from 'rxjs';
import { switchMap, take, catchError } from 'rxjs/operators';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { environment } from '../../../../environments/environment';
import { SseEvent } from '../../models/sseModel';
import { AuthService } from '../../auth/auth.service';
import { OfflineQueueProcessor } from '../../offline/offline-queue-processor.service';

@Injectable({
  providedIn: 'root'
})
export class OrderSyncService {
  private apiUrl = environment.apiUrl;
  private controller: AbortController | null = null;

  // reconnect / refresh control
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private baseReconnectDelayMs = 1000;
  private isRefreshing = false;
  private refreshQueue = new BehaviorSubject<boolean>(false);

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
  ) {}

  listenToRestaurantEvents<T = any>(restaurantId: string): Observable<SseEvent<T>> {
    // start connection immediately
    this.openConnection(restaurantId);
    return this.events$ as Observable<SseEvent<T>>;
  }

  close() {
    try {
      this.controller?.abort();
    } catch { /* ignore */ }
    this.controller = null;
    this.eventBuffer = [];
  }

  private openConnection(restaurantId: string) {
    // ensure single controller/connection
    this.close();
    this.controller = new AbortController();

    const url = `${this.apiUrl.replace(/\/$/, '')}/sse/internal/restaurant/${restaurantId}`;

    // reset reconnect attempts on manual open
    // (we'll increment on failures)
    // Note: fetchEventSource will keep the connection open until aborted or network error
    fetchEventSource(url, {
      method: 'GET',
      credentials: 'include',
      signal: this.controller.signal,
      onopen: async (response) => {
        // successful handshake
        this.ngZone.run(() => {
          this.reconnectAttempts = 0;
        });
        this.queueProcessor.processQueue();
      },
      onmessage: (msg) => {
        this.ngZone.run(() => {
          let raw: any;
          try {
            raw = JSON.parse(msg.data);
          } catch {
            raw = msg.data;
          }

          const EventType = raw.EventType ?? raw.event;
          const Data = typeof raw.Data === 'string' ? JSON.parse(raw.Data) : raw.Data;
          const Sequence = raw.Sequence ?? raw.sequence;
          const RestaurantId = raw.RestaurantId ?? raw.restaurantId;

          const sse: SseEvent<any> = { EventType, Data, Sequence, RestaurantId };

          if (this.isRefreshing && this.bufferWhileReconnecting) {
            this.bufferEvent(sse);
          } else {
            this.eventsSubject.next(sse);
          }
        });
      },
      onerror: (err) => {
        // fetchEventSource calls onerror on network/auth issues
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
          // attempt to reopen; this will again trigger refresh flow if needed
          this.openConnection(restaurantId);
        });
      } else {
        // give up: clear session and emit an error event so app can redirect to login
        console.error('[OrderSync] max reconnect attempts reached, clearing session');
        this.close();
        this.auth.clearUser();
        // emit a special event so components can react (optional)
        this.eventsSubject.next({ EventType: 'SSE_AUTH_FAILED', Data: null, Sequence: 0, RestaurantId: restaurantId });
      }
    });
  }
}
