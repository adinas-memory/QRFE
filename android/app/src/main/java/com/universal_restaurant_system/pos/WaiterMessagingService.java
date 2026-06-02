package com.universal_restaurant_system.pos;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-only FCM: native tray with channel sound + vibration (all ringer modes).
 */
public class WaiterMessagingService extends MessagingService {

    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (isWaiterPickupEvent(data)) {
            boolean foreground = isAppInForeground();
            if (!foreground) {
                WaiterCallNotificationChannels.ensure(getApplicationContext());
                showPickupNotification(data);
            } else {
                PickupAlertFeedback.alert(getApplicationContext(), "fcm-foreground");
            }
            try {
                JSONObject dbg = new JSONObject();
                dbg.put("foreground", foreground);
                dbg.put("eventType", data.get("eventType"));
                dbg.put("runId", "data-only-native");
                PickupDebugNative.log(getApplicationContext(), "H-VIB1", "WaiterMessagingService.onMessageReceived", "FCM pickup native", dbg);
            } catch (Exception ignored) {
                // ignore
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

        android.net.Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MainActivity.WAITER_CALL_CHANNEL_ID)
            .setSmallIcon(context.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setOnlyAlertOnce(false)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setSound(sound)
            .setVibrate(PickupVibrator.PICKUP_VIBRATE_PATTERN);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID.incrementAndGet(), builder.build());
        }

        // Extra vibrator pulse for devices that ignore builder vibration when sound plays.
        PickupVibrator.pulse(context, "after-tray");
    }
}
