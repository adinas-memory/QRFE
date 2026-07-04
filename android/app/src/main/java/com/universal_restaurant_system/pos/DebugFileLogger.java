// #region agent log
// Temporary NDJSON file logger for debug session e48331 (no network dependency —
// production devices use mobile data and cannot reach dev-machine tunnels/LAN).
// Writes to Android/data/<pkg>/files/Documents/debug-e48331.log so it is reachable
// via plain USB file transfer (MTP), no adb required. Remove this file after the
// debug session concludes.
package com.universal_restaurant_system.pos;

import android.content.Context;
import android.os.Environment;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

public final class DebugFileLogger {

    private static final String FILE_NAME = "debug-e48331.log";

    private DebugFileLogger() {
    }

    public static synchronized void log(
        Context context, String hypothesisId, String location, String message, String dataJson
    ) {
        try {
            File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
            if (dir == null) {
                dir = context.getFilesDir();
            }
            if (!dir.exists()) {
                dir.mkdirs();
            }
            File logFile = new File(dir, FILE_NAME);
            String line = "{\"sessionId\":\"e48331\",\"location\":\"" + escape(location)
                + "\",\"message\":\"" + escape(message) + "\",\"data\":" + dataJson
                + ",\"hypothesisId\":\"" + escape(hypothesisId)
                + "\",\"timestamp\":" + System.currentTimeMillis() + "}\n";
            try (FileWriter writer = new FileWriter(logFile, true)) {
                writer.write(line);
            }
        } catch (IOException ignored) {
            // best-effort debug logging only
        }
    }

    private static String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
// #endregion
