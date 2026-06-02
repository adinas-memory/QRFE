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

/** Pickup alert: alarm-stream sound (normal mode) + vibration in all ringer modes. */
public final class PickupAlertFeedback {

    private PickupAlertFeedback() {
    }

    static void alert(Context context, String source) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        int ringerMode = audioManager != null ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
        int notifVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION) : -1;
        int alarmVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_ALARM) : -1;

        playPickupSound(context, ringerMode, alarmVolume, notifVolume);
        PickupVibrator.pulse(context, source);
    }

    private static void playPickupSound(
        Context context,
        int ringerMode,
        int alarmVolume,
        int notifVolume
    ) {
        if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
            return;
        }

        if (alarmVolume <= 0 && notifVolume <= 0) {
            return;
        }

        int uriType = RingtoneManager.TYPE_ALARM;
        Uri uri = RingtoneManager.getDefaultUri(uriType);
        if (uri == null) {
            uriType = RingtoneManager.TYPE_NOTIFICATION;
            uri = RingtoneManager.getDefaultUri(uriType);
        }
        if (uri == null) {
            uriType = RingtoneManager.TYPE_RINGTONE;
            uri = RingtoneManager.getDefaultUri(uriType);
        }
        if (uri == null) {
            return;
        }

        final int stream = (alarmVolume > 0) ? AudioManager.STREAM_ALARM : AudioManager.STREAM_NOTIFICATION;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                MediaPlayer player = MediaPlayer.create(
                    context.getApplicationContext(),
                    uri,
                    null,
                    new AudioAttributes.Builder()
                        .setUsage(stream == AudioManager.STREAM_ALARM ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                    stream
                );
                if (player != null) {
                    player.setOnCompletionListener(MediaPlayer::release);
                    player.start();
                    return;
                }
            }

            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone == null) {
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                ringtone.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(stream == AudioManager.STREAM_ALARM ? AudioAttributes.USAGE_ALARM : AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setLegacyStreamType(stream)
                    .build());
            } else {
                ringtone.setStreamType(stream);
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
        } catch (Exception ignored) {
            // ignore
        }
    }
}
