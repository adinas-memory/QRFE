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
    }
}
