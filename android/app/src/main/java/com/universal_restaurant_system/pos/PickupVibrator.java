package com.universal_restaurant_system.pos;

import android.content.Context;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;

/** Shared pickup alert vibration for FCM service and Capacitor plugin. */
public final class PickupVibrator {

    private static final String DEBUG_TAG = "DEBUG-7379f5";
    static final long[] PICKUP_VIBRATE_PATTERN = { 0, 500, 200, 500, 200, 500 };

    private PickupVibrator() {
    }

    static boolean pulse(Context context) {
        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QRFE:PickupVibrate");
            wakeLock.acquire(3_000L);
        }

        Vibrator vibrator = getVibrator(context);
        if (vibrator == null || !vibrator.hasVibrator()) {
            Log.w(DEBUG_TAG, "No vibrator hardware");
            releaseWakeLock(wakeLock);
            return false;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(PICKUP_VIBRATE_PATTERN, -1));
            } else {
                vibrator.vibrate(PICKUP_VIBRATE_PATTERN, -1);
            }
            Log.w(DEBUG_TAG, "Native pickup vibrate triggered");
            return true;
        } catch (Exception ex) {
            Log.w(DEBUG_TAG, "Native vibrate failed: " + ex.getMessage());
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE));
                    return true;
                }
            } catch (Exception ignored) {
                // ignore
            }
            return false;
        } finally {
            releaseWakeLock(wakeLock);
        }
    }

    private static Vibrator getVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (manager == null) {
                return null;
            }
            return manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static void releaseWakeLock(PowerManager.WakeLock wakeLock) {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {
                // ignore
            }
        }
    }
}
