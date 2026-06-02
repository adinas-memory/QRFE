package com.universal_restaurant_system.pos;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PickupVibrate")
public class PickupVibratePlugin extends Plugin {

    @PluginMethod
    public void pulse(PluginCall call) {
        PickupAlertFeedback.alert(getContext(), "js-plugin");
        call.resolve();
    }
}
