package com.universal_restaurant_system.pos;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

/** Writes native debug events to Capacitor Preferences and POSTs to backend agent-log. */
final class NativeDebugHelper {

    private static final String DEBUG_TAG = "DEBUG-7379f5";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY = "debug7379f5_native";

    private NativeDebugHelper() {
    }

    static void logPickupFcm(Context context, boolean foreground, boolean vibrated, String eventType) {
        try {
            JSONObject json = new JSONObject();
            json.put("event", "fcm_pickup");
            json.put("eventType", eventType);
            json.put("foreground", foreground);
            json.put("vibrated", vibrated);
            json.put("ts", System.currentTimeMillis());
            String payload = json.toString();
            context.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, payload)
                .apply();
            Log.w(DEBUG_TAG, payload);
            postAgentLogAsync(context, payload);
        } catch (Exception ex) {
            Log.w(DEBUG_TAG, "native debug log failed: " + ex.getMessage());
        }
    }

    private static void postAgentLogAsync(Context context, String dataJson) {
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                String base = context.getString(R.string.debug_api_base).trim();
                if (base.isEmpty()) {
                    return;
                }
                URL url = new URL(base + "/api/debug/agent-log");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(4_000);
                conn.setReadTimeout(4_000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");

                JSONObject body = new JSONObject();
                body.put("sessionId", "7379f5");
                body.put("hypothesisId", "H12");
                body.put("location", "WaiterMessagingService");
                body.put("message", "native pickup handled");
                body.put("data", new JSONObject(dataJson));

                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
                int code = conn.getResponseCode();
                Log.w(DEBUG_TAG, "agent-log POST " + code);
                conn.disconnect();
            } catch (Exception ex) {
                Log.w(DEBUG_TAG, "agent-log POST failed: " + ex.getMessage());
            }
        });
    }
}
