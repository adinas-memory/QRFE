package com.universal_restaurant_system.pos;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "PickupVibrate")
public class PickupVibratePlugin extends Plugin {

    @PluginMethod
    public void pulse(PluginCall call) {
        PickupAlertFeedback.alert(getContext(), "js-plugin");
        call.resolve();
    }

    @PluginMethod
    public void getWaiterCallChannelStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("sdkInt", Build.VERSION.SDK_INT);

        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                ret.put("supported", false);
                call.resolve(ret);
                return;
            }

            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm == null) {
                ret.put("supported", true);
                ret.put("error", "no_notification_manager");
                call.resolve(ret);
                return;
            }

            NotificationChannel ch = nm.getNotificationChannel(MainActivity.WAITER_CALL_CHANNEL_ID);
            ret.put("supported", true);
            ret.put("channelExists", ch != null);
            if (ch != null) {
                ret.put("importance", ch.getImportance());
                ret.put("sound", ch.getSound() != null ? String.valueOf(ch.getSound()) : "");
                ret.put("vibrationEnabled", ch.shouldVibrate());
            }
        } catch (Exception ex) {
            ret.put("supported", true);
            ret.put("error", ex.getClass().getSimpleName());
        }

        call.resolve(ret);
    }

    @PluginMethod
    public void openWaiterCallChannelSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                intent.putExtra(Settings.EXTRA_CHANNEL_ID, MainActivity.WAITER_CALL_CHANNEL_ID);
            } else {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getClass().getSimpleName());
        }
    }
}
