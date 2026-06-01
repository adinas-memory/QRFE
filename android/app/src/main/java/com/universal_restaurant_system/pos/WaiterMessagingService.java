package com.universal_restaurant_system.pos;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * Extends Capacitor MessagingService so Firebase + PushNotificationsPlugin stay on the same classpath.
 * Hybrid FCM: Android OS shows tray + channel vibration; no duplicate native notification here.
 */
public class WaiterMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
    }
}
