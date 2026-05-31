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
import { DeviceFeedbackService } from '../device/device-feedback.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { HttpClient } from '@angular/common/http';
import {
  PushNotificationCopyService,
  WaiterPushEventType,
} from './push-notification-copy.service';

const WAITER_CALL_CHANNEL_ID = 'waiter_call_v2';
const ALERT_DEBOUNCE_MS = 5000;
const PICKUP_VIBRATE_MS = 500;

export type PickupAlertSource = 'sse' | 'fcm';

export interface DeliverPickupAlertOptions {
  eventType: WaiterPushEventType;
  tableId: string;
  tableName?: string | null;
  clientInstanceId?: string | null;
  source: PickupAlertSource;
}

/**
 * Pickup alerts on native Android:
 * - Background/killed: FCM hybrid (OS tray + vibration) via backend notification payload.
 * - Foreground: SSE → haptics + in-app toast (manage-orders); Capacitor presentationOptions=[] suppresses FCM banner.
 * - PWA/browser: SSE → LocalNotifications when tab hidden.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistrationService {
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #platform = inject(RuntimePlatformService);
  readonly #clientInstance = inject(ClientInstanceService);
  readonly #deviceFeedback = inject(DeviceFeedbackService);
  readonly #copy = inject(PushNotificationCopyService);
  readonly #destroyRef = inject(DestroyRef);

  readonly #apiUrl = environment.apiUrl;
  #currentToken: string | null = null;
  #listenersAttached = false;
  #localNotificationId = 1;
  readonly #lastAlertAtByKey = new Map<string, number>();
  #pendingPickupHapticAt = 0;
  #resumeFlushAttached = false;

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
      await this.#clientInstance.whenReady();

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

  /** SSE path (and PWA). FCM hybrid tray is handled by the OS in onPushReceived. */
  async deliverPickupAlert(options: DeliverPickupAlertOptions): Promise<void> {
    if (options.source === 'fcm') {
      return;
    }

    await this.#clientInstance.whenReady();

    const debounceKey = `${options.eventType}:${options.tableId}`;
    if (this.isDebounced(debounceKey)) {
      return;
    }

    this.markHandled(debounceKey);

    const foreground = !document.hidden;

    if (this.#deviceFeedback.hapticsEnabled) {
      await this.triggerPickupHaptic(options);
      this.#pendingPickupHapticAt = foreground ? 0 : Date.now();
    }

    // Native: background tray comes from FCM hybrid only (no LocalNotifications duplicate).
    if (!this.#platform.isNative && !foreground) {
      await this.showLocalizedNotification(options.eventType, options.tableName);
    }
  }

  wasPickupAlertHandledRecently(eventType: WaiterPushEventType, tableId: string): boolean {
    return this.isDebounced(`${eventType}:${tableId}`);
  }

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
            void this.clearDeliveredPushNotifications();
            void this.flushPendingPickupHaptic();
          }
        });
      });
    }
  }

  private isDebounced(debounceKey: string): boolean {
    const lastAt = this.#lastAlertAtByKey.get(debounceKey) ?? 0;
    return Date.now() - lastAt < ALERT_DEBOUNCE_MS;
  }

  private markHandled(debounceKey: string): void {
    this.#lastAlertAtByKey.set(debounceKey, Date.now());
  }

  private async clearDeliveredPushNotifications(): Promise<void> {
    if (!this.#platform.isNative) return;
    try {
      await PushNotifications.removeAllDeliveredNotifications();
    } catch {
      // ignore
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
    await this.triggerPickupHaptic();
  }

  private async triggerPickupHaptic(options?: DeliverPickupAlertOptions): Promise<void> {
    if (this.#platform.isNative) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Heavy });
        return;
      } catch {
        try {
          const { Haptics } = await import('@capacitor/haptics');
          await Haptics.vibrate({ duration: PICKUP_VIBRATE_MS });
          return;
        } catch {
          // fall through
        }
      }
    }

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(PICKUP_VIBRATE_MS);
      }
    } catch {
      // ignore
    }
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
    const clientInstanceId = await this.#clientInstance.whenReady();

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

  /**
   * Hybrid FCM: OS shows tray + vibration when backgrounded.
   * JS only adds extra haptics when WebView wakes and this device owns the order.
   */
  private async onPushReceived(notification: PushNotificationSchema): Promise<void> {
    if (!this.#platform.isNative) {
      return;
    }

    const payload = this.parsePayload(notification);
    if (!payload.eventType) {
      return;
    }

    const tableId = payload.tableId ?? 'unknown';
    const debounceKey = `${payload.eventType}:${tableId}`;

    if (this.isDebounced(debounceKey)) {
      return;
    }

    // Foreground: SSE + Capacitor presentationOptions=[] — skip FCM JS work.
    if (!document.hidden) {
      return;
    }

    this.markHandled(debounceKey);

    await this.#clientInstance.whenReady();
    const isTarget = this.#clientInstance.isPickupTarget(payload.clientInstanceId);
    if (isTarget && this.#deviceFeedback.hapticsEnabled) {
      await this.triggerPickupHaptic({
        eventType: payload.eventType,
        tableId,
        tableName: payload.tableName,
        clientInstanceId: payload.clientInstanceId,
        source: 'fcm',
      });
    }
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
