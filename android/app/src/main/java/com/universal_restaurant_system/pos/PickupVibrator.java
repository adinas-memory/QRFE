package com.universal_restaurant_system.pos;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import org.json.JSONObject;

/** Shared pickup alert vibration for FCM service and Capacitor plugin. */
public final class PickupVibrator {

    static final long[] PICKUP_VIBRATE_PATTERN = { 0, 500, 200, 500, 200, 500 };

    private static final int[] PICKUP_VIBRATE_AMPLITUDES = { 0, 255, 0, 255, 0, 255 };

    private PickupVibrator() {
    }

    static boolean pulse(Context context) {
        return pulse(context, "unknown");
    }

    static boolean pulse(Context context, String source) {
        Vibrator vibrator = getVibrator(context);
        boolean hasVibrator = vibrator != null && vibrator.hasVibrator();
        if (!hasVibrator) {
            logPulse(context, source, false, "no_vibrator");
            return false;
        }

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        long patternMs = sumPattern(PICKUP_VIBRATE_PATTERN);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QRFE:PickupVibrate");
            wakeLock.acquire(Math.max(patternMs + 500L, 2_000L));
        }

        PowerManager.WakeLock lockToRelease = wakeLock;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                VibrationAttributes attrs = new VibrationAttributes.Builder()
                    .setUsage(VibrationAttributes.USAGE_NOTIFICATION)
                    .build();
                vibrator.vibrate(
                    VibrationEffect.createWaveform(PICKUP_VIBRATE_PATTERN, PICKUP_VIBRATE_AMPLITUDES, -1),
                    attrs
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(PICKUP_VIBRATE_PATTERN, PICKUP_VIBRATE_AMPLITUDES, -1));
            } else {
                vibrator.vibrate(PICKUP_VIBRATE_PATTERN, -1);
            }
            logPulse(context, source, true, "waveform");
            scheduleWakeLockRelease(lockToRelease, patternMs + 300L);
            return true;
        } catch (Exception ex) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(800, VibrationEffect.DEFAULT_AMPLITUDE));
                    logPulse(context, source, true, "one_shot_fallback");
                    scheduleWakeLockRelease(lockToRelease, 1_100L);
                    return true;
                }
            } catch (Exception ignored) {
                // ignore
            }
            logPulse(context, source, false, ex.getClass().getSimpleName());
            releaseWakeLock(lockToRelease);
            return false;
        }
    }

    private static void logPulse(Context context, String source, boolean ok, String detail) {
        try {
            JSONObject dbg = new JSONObject();
            dbg.put("source", source);
            dbg.put("ok", ok);
            dbg.put("detail", detail);
            dbg.put("runId", "notif-stream");
            PickupDebugNative.log(context, "H-VIB1", "PickupVibrator.pulse", "native vibrate", dbg);
        } catch (Exception ignored) {
            // ignore
        }
    }

    private static long sumPattern(long[] pattern) {
        long total = 0L;
        for (long step : pattern) {
            total += step;
        }
        return total;
    }

    private static void scheduleWakeLockRelease(PowerManager.WakeLock wakeLock, long delayMs) {
        if (wakeLock == null) {
            return;
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> releaseWakeLock(wakeLock), delayMs);
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
