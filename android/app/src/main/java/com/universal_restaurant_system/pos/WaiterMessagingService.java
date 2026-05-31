package com.universal_restaurant_system.pos;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-only FCM: onMessageReceived runs in background (hybrid notification payload does not).
 * Shows tray + vibrates when app is not in foreground.
 */
public class WaiterMessagingService extends MessagingService {

    private static final long[] PICKUP_VIBRATE_PATTERN = { 0, 500, 200, 500, 200, 500 };
    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        if (!isWaiterPickupEvent(remoteMessage.getData())) {
            return;
        }

        if (!isAppInForeground()) {
            showPickupNotification(remoteMessage.getData());
            vibrateDevice();
        }
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
        String title = data.get("title");
        String body = data.get("body");
        if (title == null || title.isEmpty()) {
            title = "Kitchen";
        }
        if (body == null || body.isEmpty()) {
            body = "Order ready for pickup";
        }

        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, MainActivity.WAITER_CALL_CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_SOUND)
            .setVibrate(PICKUP_VIBRATE_PATTERN);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID.incrementAndGet(), builder.build());
        }
    }

    private void vibrateDevice() {
        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
            if (manager == null) {
                return;
            }
            vibrator = manager.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        }
        if (vibrator == null || !vibrator.hasVibrator()) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(PICKUP_VIBRATE_PATTERN, -1));
        } else {
            vibrator.vibrate(PICKUP_VIBRATE_PATTERN, -1);
        }
    }
}
