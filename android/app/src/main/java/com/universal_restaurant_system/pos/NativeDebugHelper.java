package com.universal_restaurant_system.pos;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

/** Writes native debug events to Capacitor Preferences storage for JS flush to backend. */
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
        } catch (Exception ex) {
            Log.w(DEBUG_TAG, "native debug log failed: " + ex.getMessage());
        }
    }
}
