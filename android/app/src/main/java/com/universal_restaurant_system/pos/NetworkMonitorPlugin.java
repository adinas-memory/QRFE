package com.universal_restaurant_system.pos;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

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

    // #region agent log
    @PluginMethod
    public void writeDebugLog(PluginCall call) {
        String hypothesisId = call.getString("hypothesisId", "");
        String location = call.getString("location", "");
        String message = call.getString("message", "");
        String dataJson = call.getString("dataJson", "{}");
        DebugFileLogger.log(getContext().getApplicationContext(), hypothesisId, location, message, dataJson);
        call.resolve();
    }
    // #endregion

    private void emitNetworkStatus(boolean online) {
        JSObject payload = new JSObject();
        payload.put("online", online);
        notifyListeners("networkStatusChange", payload);
    }
}
