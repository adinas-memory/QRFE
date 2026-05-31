package com.universal_restaurant_system.pos;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Must match FCM channel_id and Capacitor PushNotifications.createChannel id. */
    public static final String WAITER_CALL_CHANNEL_ID = "waiter_call_v3";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createWaiterCallNotificationChannel();
    }

    private void createWaiterCallNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }

        NotificationChannel existing = manager.getNotificationChannel(WAITER_CALL_CHANNEL_ID);
        if (existing != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            WAITER_CALL_CHANNEL_ID,
            "Waiter calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Kitchen, bar, and table waiter alerts");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 500, 200, 500, 200, 500 });
        channel.enableLights(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        Uri sound = android.provider.Settings.System.DEFAULT_NOTIFICATION_URI;
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, audioAttributes);

        manager.createNotificationChannel(channel);
    }
}
