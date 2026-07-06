package com.universal_restaurant_system.pos;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "NetworkMonitor")
public class NetworkMonitorPlugin extends Plugin {

    @Override
    public void load() {
        NetworkMonitorService.setNetworkListener(new NetworkMonitorService.NetworkListener() {
            @Override
            public void onNetworkAvailable() {
                emitNetworkStatus(true);
            }

            @Override
            public void onNetworkLost() {
                emitNetworkStatus(false);
            }
        });
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), NetworkMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), NetworkMonitorService.class));
        call.resolve();
    }

    @PluginMethod
    public void writeDebugLog(PluginCall call) {
        String category = call.getString("category", "");
        String location = call.getString("location", "");
        String message = call.getString("message", "");
        String dataJson = call.getString("dataJson", "{}");
        DebugFileLogger.log(getContext().getApplicationContext(), category, location, message, dataJson);
        call.resolve();
    }

    @PluginMethod
    public void shareDebugLog(PluginCall call) {
        try {
            File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
            if (dir == null) {
                dir = getContext().getFilesDir();
            }
            File logFile = new File(dir, DebugFileLogger.FILE_NAME);
            if (!logFile.exists()) {
                call.reject("log-file-not-found");
                return;
            }
            Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", logFile
            );
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(shareIntent, "Export " + DebugFileLogger.FILE_NAME);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("share-failed: " + e.getMessage());
        }
    }

    private void emitNetworkStatus(boolean online) {
        JSObject payload = new JSObject();
        payload.put("online", online);
        notifyListeners("networkStatusChange", payload);
    }
}
