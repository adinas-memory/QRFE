package com.universal_restaurant_system.pos;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.util.Map;

/**
 * Hybrid FCM: OS shows tray in background. Pulse vibrator when this service receives pickup data
 * (foreground / OEMs that still deliver onMessageReceived) — no duplicate notification.
 */
public class WaiterMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        if (isWaiterPickupEvent(data)) {
            boolean foreground = isAppInForeground();
            boolean vibrated = PickupVibrator.pulse(getApplicationContext(), "fcm-service");
            try {
                JSONObject dbg = new JSONObject();
                dbg.put("foreground", foreground);
                dbg.put("vibrated", vibrated);
                dbg.put("hasNotificationPayload", remoteMessage.getNotification() != null);
                dbg.put("eventType", data.get("eventType"));
                dbg.put("runId", "fcm-hybrid-fallback");
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
        android.app.ActivityManager.RunningAppProcessInfo info = new android.app.ActivityManager.RunningAppProcessInfo();
        android.app.ActivityManager.getMyMemoryState(info);
        return info.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            || info.importance == android.app.ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }
}
