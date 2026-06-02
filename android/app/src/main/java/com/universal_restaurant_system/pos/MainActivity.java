package com.universal_restaurant_system.pos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Must match FCM channel_id and Capacitor PushNotifications.createChannel id. */
    public static final String WAITER_CALL_CHANNEL_ID = "waiter_call_v5";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PickupVibratePlugin.class);
        super.onCreate(savedInstanceState);
        WaiterCallNotificationChannels.ensure(this);
        try {
            org.json.JSONObject dbg = new org.json.JSONObject();
            dbg.put("runId", "sound-fix-v2");
            PickupDebugNative.log(this, "H-VIB1", "MainActivity.onCreate", "native app started", dbg);
        } catch (Exception ignored) {
            // ignore
        }
    }
}
