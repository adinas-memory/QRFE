package com.universal_restaurant_system.pos;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Ensures pickup and guest-waiter FCM notification channels (Android O+). */
public final class WaiterCallNotificationChannels {

    private WaiterCallNotificationChannels() {
    }

    static void ensurePickupChannel(Context context) {
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

        NotificationChannel channel = buildHighPriorityChannel(
            MainActivity.WAITER_CALL_CHANNEL_ID,
            "Waiter calls",
            "Kitchen, bar pickup alerts"
        );
        manager.createNotificationChannel(channel);
    }

    static void ensureGuestWaiterChannel(Context context, String restaurantId, String displayName) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        String channelId = GuestWaiterChannelIds.forRestaurantId(restaurantId);
        NotificationChannel existing = manager.getNotificationChannel(channelId);
        if (existing != null) {
            manager.deleteNotificationChannel(channelId);
        }

        String label = displayName == null || displayName.trim().isEmpty()
            ? "Guest waiter calls"
            : displayName.trim() + " — guest calls";

        NotificationChannel channel = buildHighPriorityChannel(channelId, label, "Guest calling the waiter");
        manager.createNotificationChannel(channel);
    }

    private static NotificationChannel buildHighPriorityChannel(
        String channelId,
        String name,
        String description
    ) {
        NotificationChannel channel = new NotificationChannel(
            channelId,
            name,
            NotificationManager.IMPORTANCE_MAX
        );
        channel.setDescription(description);
        channel.enableVibration(true);
        channel.setVibrationPattern(PickupVibrator.PICKUP_VIBRATE_PATTERN);
        channel.enableLights(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            channel.setAllowBubbles(true);
        }

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) {
            sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        if (sound == null) {
            sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, audioAttributes);
        return channel;
    }
}
