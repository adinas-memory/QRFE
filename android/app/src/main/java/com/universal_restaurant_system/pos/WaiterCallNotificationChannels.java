package com.universal_restaurant_system.pos;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Ensures pickup FCM notifications use a high-priority channel with vibration (Android O+). */
public final class WaiterCallNotificationChannels {

    private WaiterCallNotificationChannels() {
    }

    static void ensure(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel existing = manager.getNotificationChannel(MainActivity.WAITER_CALL_CHANNEL_ID);
        if (existing != null) {
            manager.deleteNotificationChannel(MainActivity.WAITER_CALL_CHANNEL_ID);
        }

        NotificationChannel channel = new NotificationChannel(
            MainActivity.WAITER_CALL_CHANNEL_ID,
            "Waiter calls",
            NotificationManager.IMPORTANCE_MAX
        );
        channel.setDescription("Kitchen, bar, and table waiter alerts");
        channel.enableVibration(true);
        channel.setVibrationPattern(PickupVibrator.PICKUP_VIBRATE_PATTERN);
        channel.enableLights(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            channel.setAllowBubbles(true);
        }

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (sound == null) {
            sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, audioAttributes);

        manager.createNotificationChannel(channel);
    }
}
