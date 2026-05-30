import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  RegistrationError,
  Token,
} from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { ClientInstanceService } from '../device/client-instance.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { HttpClient } from '@angular/common/http';
import {
  PushNotificationCopyService,
  WaiterPushEventType,
} from './push-notification-copy.service';

const WAITER_CALL_CHANNEL_ID = 'waiter_call';
const ALERT_DEBOUNCE_MS = 2000;
const PICKUP_VIBRATE_MS = 500;

export type PickupAlertSource = 'sse' | 'fcm';

export interface DeliverPickupAlertOptions {
  eventType: WaiterPushEventType;
  tableId: string;
  tableName?: string | null;
  clientInstanceId?: string | null;
  source: PickupAlertSource;
}

@Injectable({ providedIn: 'root' })
export class PushRegistrationService {
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #platform = inject(RuntimePlatformService);
  readonly #clientInstance = inject(ClientInstanceService);
  readonly #copy = inject(PushNotificationCopyService);
  readonly #destroyRef = inject(DestroyRef);

  readonly #apiUrl = environment.apiUrl;
  #currentToken: string | null = null;
  #listenersAttached = false;
  #localNotificationId = 1;
  readonly #lastAlertAtByKey = new Map<string, number>();
  #pendingPickupHapticAt = 0;
  #resumeFlushAttached = false;

  /** Call once after app bootstrap; registers push when user logs in on native Android. */
  init(): void {
    this.ensureHapticResumeFlush();

    if (!this.#platform.isNative) {
      return;
    }

    this.#auth
      .getUserContext()
      .pipe(
        filter((u) => !!u?.restaurantId),
        take(1),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe(() => {
        void this.ensureRegistered();
      });

    this.#auth.loggedIn$.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe(() => {
      void this.ensureRegistered();
    });
  }

  async ensureRegistered(): Promise<void> {
    if (!this.#platform.isNative) {
      return;
    }

    try {
      await this.attachListeners();
      await this.createAndroidChannels();
      await this.ensureLocalNotificationPermission();

      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') {
        return;
      }

      await PushNotifications.register();
    } catch (err) {
      console.warn('[PushRegistration] setup failed', err);
    }
  }

  /**
   * Haptics + localized tray notification (foreground). Background tray uses FCM notification payload.
   */
  async deliverPickupAlert(options: DeliverPickupAlertOptions): Promise<void> {
    const targetId = (options.clientInstanceId ?? '').trim();
    const localId = this.#clientInstance.getId();
    const isTarget = !targetId || (!!localId && targetId === localId);

    const debounceKey = `${options.source}:${options.eventType}:${options.tableId}`;
    const now = Date.now();
    const debounced = now - (this.#lastAlertAtByKey.get(debounceKey) ?? 0) < ALERT_DEBOUNCE_MS;
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'push-registration.service.ts:deliverPickupAlert',message:'pickup_alert_eval',data:{source:options.source,eventType:options.eventType,tableId:options.tableId,isTarget,debounced,targetId,localId,documentHidden:document.hidden},timestamp:Date.now(),hypothesisId: isTarget ? (debounced ? 'H4' : 'H3') : 'H3'})}).catch(()=>{});
    // #endregion

    if (!isTarget) {
      return;
    }

    if (debounced) {
      return;
    }
    this.#lastAlertAtByKey.set(debounceKey, now);

    const hidden = document.hidden;
    await this.triggerPickupHaptic(options);
    if (hidden) {
      this.#pendingPickupHapticAt = now;
      // #region agent log
      fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'push-registration.service.ts:deliverPickupAlert',message:'haptic_retry_scheduled',data:{source:options.source,eventType:options.eventType,tableId:options.tableId},timestamp:Date.now(),hypothesisId:'H7',runId:'post-fix-2'})}).catch(()=>{});
      console.warn('[DEBUG-7379f5] haptic_retry_scheduled', options.eventType, options.tableId);
      // #endregion
    } else {
      this.#pendingPickupHapticAt = 0;
    }

    // Foreground: localized notification via LocalNotifications.
    // Background: FCM hybrid payload already shows system tray (English fallback).
    if (!document.hidden) {
      await this.showLocalizedNotification(options.eventType, options.tableName);
    }
  }

  /** Flush haptics queued while the app/tab was hidden (SSE or FCM). */
  ensureHapticResumeFlush(): void {
    if (this.#resumeFlushAttached) {
      return;
    }
    this.#resumeFlushAttached = true;

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        void this.flushPendingPickupHaptic();
      }
    });

    if (this.#platform.isNative) {
      void import('@capacitor/app').then(({ App }) => {
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void this.flushPendingPickupHaptic();
          }
        });
      });
    }
  }

  private async flushPendingPickupHaptic(): Promise<void> {
    if (!this.#pendingPickupHapticAt) {
      return;
    }
    const ageMs = Date.now() - this.#pendingPickupHapticAt;
    if (ageMs > 60_000) {
      this.#pendingPickupHapticAt = 0;
      return;
    }
    this.#pendingPickupHapticAt = 0;
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'push-registration.service.ts:flushPendingPickupHaptic',message:'haptic_flush_on_resume',data:{documentHidden:document.hidden,ageMs},timestamp:Date.now(),hypothesisId:'H7',runId:'post-fix-2'})}).catch(()=>{});
    console.warn('[DEBUG-7379f5] haptic_flush_on_resume', ageMs);
    // #endregion
    await this.triggerPickupHaptic();
  }

  private async triggerPickupHaptic(options?: DeliverPickupAlertOptions): Promise<void> {
    let hapticOk = false;

    if (this.#platform.isNative) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Heavy });
        hapticOk = true;
      } catch {
        try {
          const { Haptics } = await import('@capacitor/haptics');
          await Haptics.vibrate({ duration: PICKUP_VIBRATE_MS });
          hapticOk = true;
        } catch {
          // fall through to web vibrate
        }
      }
    }

    if (!hapticOk) {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(PICKUP_VIBRATE_MS);
          hapticOk = true;
        }
      } catch {
        // ignore
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'push-registration.service.ts:triggerPickupHaptic',message:'haptic_triggered',data:{hapticOk,source:options?.source,eventType:options?.eventType,documentHidden:document.hidden,isNative:this.#platform.isNative},timestamp:Date.now(),hypothesisId:'H7',runId:'post-fix-2'})}).catch(()=>{});
    console.warn('[DEBUG-7379f5] haptic_triggered', { hapticOk, eventType: options?.eventType, hidden: document.hidden });
    // #endregion
  }

  async unregisterCurrentToken(): Promise<void> {
    const token = this.#currentToken;
    const restaurantId = this.#auth.getUserRestaurantId();
    if (!token || typeof restaurantId !== 'string' || !restaurantId) {
      return;
    }

    try {
      await firstValueFrom(
        this.#http.request('DELETE', `${this.#apiUrl}/api/user/device-token`, {
          body: { token, restaurantId },
          withCredentials: true,
        }),
      );
    } catch {
      // ignore logout cleanup errors
    } finally {
      this.#currentToken = null;
    }
  }

  private async attachListeners(): Promise<void> {
    if (this.#listenersAttached) {
      return;
    }
    this.#listenersAttached = true;

    await PushNotifications.addListener('registration', (token: Token) => {
      void this.onToken(token.value);
    });

    await PushNotifications.addListener('registrationError', (err: RegistrationError) => {
      console.warn('[PushRegistration] registration error', err);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      void this.onPushReceived(notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      void this.onPushAction(action);
    });

    await LocalNotifications.addListener('localNotificationActionPerformed', () => {
      void this.#router.navigate(['/staff/manage-orders']);
    });
  }

  private async createAndroidChannels(): Promise<void> {
    if (this.#platform.capabilities.surface !== 'capacitor-android') {
      return;
    }
    try {
      await PushNotifications.createChannel({
        id: WAITER_CALL_CHANNEL_ID,
        name: 'Waiter calls',
        description: 'Kitchen, bar, and table waiter alerts',
        importance: 5,
        vibration: true,
        visibility: 1,
      });
      await LocalNotifications.createChannel({
        id: WAITER_CALL_CHANNEL_ID,
        name: 'Waiter calls',
        description: 'Kitchen, bar, and table waiter alerts',
        importance: 5,
        vibration: true,
        visibility: 1,
      });
    } catch {
      // channel may already exist
    }
  }

  private async ensureLocalNotificationPermission(): Promise<void> {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      // ignore
    }
  }

  private async onToken(token: string): Promise<void> {
    const restaurantId = this.#auth.getUserRestaurantId();
    if (!token || typeof restaurantId !== 'string' || !restaurantId) {
      return;
    }

    this.#currentToken = token;
    const clientInstanceId = this.#clientInstance.getId();

    try {
      await firstValueFrom(
        this.#http.post(
          `${this.#apiUrl}/api/user/device-token`,
          { token, restaurantId, clientInstanceId },
          { withCredentials: true },
        ),
      );
    } catch (err) {
      console.warn('[PushRegistration] token register failed', err);
    }
  }

  private async onPushReceived(notification: PushNotificationSchema): Promise<void> {
    if (!this.#platform.isNative) {
      return;
    }

    const payload = this.parsePayload(notification);
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'push-registration.service.ts:onPushReceived',message:'fcm_push_received',data:{eventType:payload.eventType,tableId:payload.tableId,clientInstanceId:payload.clientInstanceId,documentHidden:document.hidden},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (!payload.eventType) {
      return;
    }

    const tableId = payload.tableId ?? 'unknown';

    await this.deliverPickupAlert({
      eventType: payload.eventType,
      tableId,
      tableName: payload.tableName,
      clientInstanceId: payload.clientInstanceId,
      source: 'fcm',
    });
  }

  private async showLocalizedNotification(
    eventType: WaiterPushEventType,
    tableName?: string | null,
  ): Promise<void> {
    const title = this.#copy.titleFor(eventType);
    const body = this.#copy.bodyFor(eventType, tableName);
    const id = this.nextLocalNotificationId();

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            channelId: WAITER_CALL_CHANNEL_ID,
            extra: { eventType, tableName: tableName ?? '' },
          },
        ],
      });
    } catch (err) {
      console.warn('[PushRegistration] local notification failed', err);
    }
  }

  private parsePayload(notification: PushNotificationSchema): {
    eventType: WaiterPushEventType | null;
    tableName: string | null;
    tableId: string | null;
    clientInstanceId: string | null;
  } {
    const raw = (notification.data ?? {}) as Record<string, unknown>;
    const eventType = this.field(raw, 'eventType', 'EventType');
    const tableName = this.field(raw, 'tableName', 'TableName');
    const tableId = this.field(raw, 'tableId', 'TableId');
    const clientInstanceId = this.field(raw, 'clientInstanceId', 'ClientInstanceId');
    return {
      eventType: eventType as WaiterPushEventType | null,
      tableName,
      tableId,
      clientInstanceId,
    };
  }

  private field(
    obj: Record<string, unknown>,
    camel: string,
    pascal: string,
  ): string | null {
    const v = obj[camel] ?? obj[pascal];
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  }

  private nextLocalNotificationId(): number {
    this.#localNotificationId = (this.#localNotificationId % 2_000_000_000) + 1;
    return this.#localNotificationId;
  }

  private async onPushAction(_action: ActionPerformed): Promise<void> {
    await this.#router.navigate(['/staff/manage-orders']);
  }
}
