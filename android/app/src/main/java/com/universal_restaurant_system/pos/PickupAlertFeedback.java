package com.universal_restaurant_system.pos;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

/** Pickup alert: notification-stream vibration + optional sound when ringer is not silent. */
public final class PickupAlertFeedback {

    private PickupAlertFeedback() {
    }

    static void alert(Context context, String source) {
        playNotificationSoundIfAudible(context);
        PickupVibrator.pulse(context, source);
    }

    private static void playNotificationSoundIfAudible(Context context) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            return;
        }
        int ringerMode = audioManager.getRingerMode();
        if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
            return;
        }
        if (audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION) <= 0
            && ringerMode != AudioManager.RINGER_MODE_VIBRATE) {
            return;
        }

        try {
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (uri == null) {
                uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            if (uri == null) {
                return;
            }
            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone == null) {
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setLegacyStreamType(AudioManager.STREAM_NOTIFICATION)
                    .build());
            } else {
                ringtone.setStreamType(AudioManager.STREAM_NOTIFICATION);
            }
            ringtone.play();
        } catch (Exception ignored) {
            // ignore
        }
    }
}
