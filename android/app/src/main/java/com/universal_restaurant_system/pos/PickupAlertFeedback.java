package com.universal_restaurant_system.pos;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;

/** Pickup alert: alarm-stream sound (normal mode) + vibration in all ringer modes. */
public final class PickupAlertFeedback {

    private PickupAlertFeedback() {
    }

    static void alert(Context context, String source) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        int ringerMode = audioManager != null ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
        int notifVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION) : -1;
        int alarmVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_ALARM) : -1;

        boolean playedSound = playPickupSound(context, ringerMode);
        boolean vibrated = PickupVibrator.pulse(context, source);

        logFeedback(context, source, ringerMode, notifVolume, alarmVolume, playedSound, vibrated);
    }

    private static boolean playPickupSound(Context context, int ringerMode) {
        if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
            return false;
        }

        Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (uri == null) {
            uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        if (uri == null) {
            uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        if (uri == null) {
            return false;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                MediaPlayer player = MediaPlayer.create(
                    context.getApplicationContext(),
                    uri,
                    null,
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                    AudioManager.STREAM_ALARM
                );
                if (player != null) {
                    player.setOnCompletionListener(MediaPlayer::release);
                    player.start();
                    return true;
                }
            }

            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone == null) {
                return false;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setLegacyStreamType(AudioManager.STREAM_ALARM)
                    .build());
            } else {
                ringtone.setStreamType(AudioManager.STREAM_ALARM);
            }
            ringtone.play();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (ringtone.isPlaying()) {
                        ringtone.stop();
                    }
                } catch (Exception ignored) {
                    // ignore
                }
            }, 3_000L);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void logFeedback(
        Context context,
        String source,
        int ringerMode,
        int notifVolume,
        int alarmVolume,
        boolean playedSound,
        boolean vibrated
    ) {
        try {
            JSONObject dbg = new JSONObject();
            dbg.put("source", source);
            dbg.put("ringerMode", ringerMode);
            dbg.put("notifVolume", notifVolume);
            dbg.put("alarmVolume", alarmVolume);
            dbg.put("playedSound", playedSound);
            dbg.put("vibrated", vibrated);
            dbg.put("runId", "sound-fix-v2");
            PickupDebugNative.log(context, "H-SOUND", "PickupAlertFeedback.alert", "pickup feedback", dbg);
        } catch (Exception ignored) {
            // ignore
        }
    }
}
