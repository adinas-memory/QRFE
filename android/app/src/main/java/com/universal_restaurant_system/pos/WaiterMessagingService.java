package com.universal_restaurant_system.pos;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Data-only FCM: onMessageReceived runs in background (hybrid notification payload does not).
 * Shows tray when app is not in foreground; always vibrates on pickup FCM.
 */
public class WaiterMessagingService extends FirebaseMessagingService {

    private static final String DEBUG_TAG = "DEBUG-7379f5";
    private static final long[] PICKUP_VIBRATE_PATTERN = { 0, 500, 200, 500, 200, 500 };
    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        boolean pickup = isWaiterPickupEvent(data);

        if (pickup) {
            boolean foreground = isAppInForeground();
            Log.w(DEBUG_TAG, "FCM pickup received foreground=" + foreground + " data=" + data);

            boolean vibrated = vibrateDevice();
            if (!foreground) {
                showPickupNotification(data);
            }

            String eventType = data.get("eventType");
            NativeDebugHelper.logPickupFcm(getApplicationContext(), foreground, vibrated, eventType);
        }

        PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
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
            .setVibrate(PICKUP_VIBRATE_PATTERN);

        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID.incrementAndGet(), builder.build());
        }
    }

    private boolean vibrateDevice() {
        Context context = getApplicationContext();
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QRFE:PickupVibrate");
            wakeLock.acquire(3_000L);
        }

        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (manager == null) {
                Log.w(DEBUG_TAG, "VibratorManager unavailable");
                releaseWakeLock(wakeLock);
                return false;
            }
            vibrator = manager.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (vibrator == null || !vibrator.hasVibrator()) {
            Log.w(DEBUG_TAG, "No vibrator hardware");
            releaseWakeLock(wakeLock);
            return false;
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(PICKUP_VIBRATE_PATTERN, -1));
            } else {
                vibrator.vibrate(PICKUP_VIBRATE_PATTERN, -1);
            }
            Log.w(DEBUG_TAG, "Native pickup vibrate triggered");
            return true;
        } catch (Exception ex) {
            Log.w(DEBUG_TAG, "Native vibrate failed: " + ex.getMessage());
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE));
                    return true;
                }
            } catch (Exception ignored) {
                // ignore
            }
            return false;
        } finally {
            releaseWakeLock(wakeLock);
        }
    }

    private static void releaseWakeLock(PowerManager.WakeLock wakeLock) {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
                // ignore
            }
        }
    }
}
