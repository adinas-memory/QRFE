package com.universal_restaurant_system.pos;

import android.content.Context;
import android.os.Environment;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

/** NDJSON file logger for on-device export (no network dependency). */
public final class DebugFileLogger {

    static final String FILE_NAME = "qrfe-debug.log";

    private DebugFileLogger() {
    }

    public static synchronized void log(
        Context context, String category, String location, String message, String dataJson
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
            String line = "{\"category\":\"" + escape(category)
                + "\",\"location\":\"" + escape(location)
                + "\",\"message\":\"" + escape(message) + "\",\"data\":" + dataJson
                + ",\"timestamp\":" + System.currentTimeMillis() + "}\n";
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
