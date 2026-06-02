package com.universal_restaurant_system.pos;

import android.content.Context;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

/** Native pickup debug → backend agent-log (dev). */
final class PickupDebugNative {

    private PickupDebugNative() {
    }

    static void log(Context context, String hypothesisId, String location, String message, JSONObject data) {
        Executors.newSingleThreadExecutor().execute(() -> post(context, hypothesisId, location, message, data));
    }

    private static void post(Context context, String hypothesisId, String location, String message, JSONObject data) {
        try {
            String base = context.getString(R.string.debug_api_base).trim();
            if (base.isEmpty()) {
                return;
            }
            JSONObject body = new JSONObject();
            body.put("sessionId", "7379f5");
            body.put("hypothesisId", hypothesisId);
            body.put("location", location);
            body.put("message", message);
            body.put("data", data);

            URL url = new URL(base + "/api/debug/agent-log");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(4_000);
            conn.setReadTimeout(4_000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Debug-Session-Id", "7379f5");

            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
            conn.getResponseCode();
            conn.disconnect();
        } catch (Exception ignored) {
            // ignore
        }
    }
}
