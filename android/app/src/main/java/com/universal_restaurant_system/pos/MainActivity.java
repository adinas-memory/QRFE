package com.universal_restaurant_system.pos;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Must match FCM channel_id and Capacitor PushNotifications.createChannel id. */
    public static final String WAITER_CALL_CHANNEL_ID = "waiter_call_v5";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PickupVibratePlugin.class);
        registerPlugin(NetworkMonitorPlugin.class);
        super.onCreate(savedInstanceState);
        WaiterCallNotificationChannels.ensurePickupChannel(this);
    }

    @Override
    public void onStart() {
        super.onStart();
        allowHttpApiFromHttpsWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        allowHttpApiFromHttpsWebView();
    }

    /**
     * LAN debug APKs may bundle assets under https://localhost while apiUrl is http://LAN_IP.
     * Without androidScheme:http, WebView blocks fetch() as mixed content even when
     * network_security_config permits cleartext to the LAN host.
     */
    private void allowHttpApiFromHttpsWebView() {
        if (getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
}
