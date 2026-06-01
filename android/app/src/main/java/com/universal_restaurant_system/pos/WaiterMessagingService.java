package com.universal_restaurant_system.pos;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Extends Capacitor MessagingService so Firebase + PushNotificationsPlugin stay on the same classpath.
 * Data-only FCM: vibrates on pickup; shows tray when app is not in foreground.
 */
public class WaiterMessagingService extends MessagingService {

    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (isWaiterPickupEvent(data)) {
            boolean foreground = isAppInForeground();
            PickupVibrator.pulse(getApplicationContext());
            if (!foreground) {
                showPickupNotification(data);
            }
        }

        super.onMessageReceived(remoteMessage);
    }

    private static boolean isWaiterPickupEvent(Map<String, String> data) {
        if (data == null) {
            return false;
        }
        String eventType = data.get("eventType");
        return "KitchenWaiterCall".equals(eventType) || "BarWaiterCall".equals(eventType);
    }

    private boolean isAppInForeground() {
        ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(info);
        return info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            || info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }

    private void showPickupNotification(Map<String, String> data) {
        Context context = getApplicationContext();
        String title = data.get("title");
        String body = data.get("body");
        if (title == null || title.isEmpty()) {
            title = "Kitchen";
        }
        if (body == null || body.isEmpty()) {
            body = "Order ready for pickup";
        }

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MainActivity.WAITER_CALL_CHANNEL_ID)
            .setSmallIcon(context.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVibrate(PickupVibrator.PICKUP_VIBRATE_PATTERN);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID.incrementAndGet(), builder.build());
        }
    }
}
