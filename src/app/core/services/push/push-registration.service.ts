import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { ActionPerformed, PushNotifications, RegistrationError, Token } from '@capacitor/push-notifications';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../auth/auth.service';
import { ClientInstanceService } from '../device/client-instance.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';
import { HttpClient } from '@angular/common/http';

const WAITER_CALL_CHANNEL_ID = 'waiter_call';

@Injectable({ providedIn: 'root' })
export class PushRegistrationService {
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #platform = inject(RuntimePlatformService);
  readonly #clientInstance = inject(ClientInstanceService);
  readonly #destroyRef = inject(DestroyRef);

  readonly #apiUrl = environment.apiUrl;
  #currentToken: string | null = null;
  #listenersAttached = false;

  /** Call once after app bootstrap; registers push when user logs in on native Android. */
  init(): void {
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
      await this.createAndroidChannel();

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

    await PushNotifications.addListener('pushNotificationReceived', () => {
      void this.onPushReceived();
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      void this.onPushAction(action);
    });
  }

  private async createAndroidChannel(): Promise<void> {
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
    } catch {
      // channel may already exist
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

  private async onPushReceived(): Promise<void> {
    if (!this.#platform.isNative) {
      return;
    }
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // FCM notification channel may already vibrate
    }
  }

  private async onPushAction(_action: ActionPerformed): Promise<void> {
    await this.#router.navigate(['/staff/manage-orders']);
  }
}
