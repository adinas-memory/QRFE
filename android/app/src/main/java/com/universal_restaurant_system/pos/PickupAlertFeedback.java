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

        JSONObject sound = buildAndPlaySound(context, ringerMode, alarmVolume, notifVolume);
        boolean playedSound = sound.optBoolean("playedSound", false);
        boolean vibrated = PickupVibrator.pulse(context, source);

        logFeedback(context, source, ringerMode, notifVolume, alarmVolume, playedSound, vibrated, sound);
    }

    static String alertAndDescribe(Context context, String source) {
        AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        int ringerMode = audioManager != null ? audioManager.getRingerMode() : AudioManager.RINGER_MODE_NORMAL;
        int notifVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION) : -1;
        int alarmVolume = audioManager != null ? audioManager.getStreamVolume(AudioManager.STREAM_ALARM) : -1;

        JSONObject sound = buildAndPlaySound(context, ringerMode, alarmVolume, notifVolume);
        boolean vibrated = PickupVibrator.pulse(context, source);

        try {
            sound.put("vibrated", vibrated);
            sound.put("onMain", Looper.myLooper() == Looper.getMainLooper());
        } catch (Exception ignored) {
            // ignore
        }

        // Compact string for notification text (avoid huge URIs).
        String reason = sound.optString("reason", "");
        String path = sound.optString("path", "");
        String ex = sound.optString("ex", "");
        int stream = sound.optInt("stream", -1);
        int uriType = sound.optInt("uriType", -1);
        boolean played = sound.optBoolean("playedSound", false);
        boolean onMain = sound.optBoolean("onMain", false);
        boolean vib = sound.optBoolean("vibrated", false);
        return "ps=" + (played ? 1 : 0)
            + " vib=" + (vib ? 1 : 0)
            + " st=" + stream
            + " ut=" + uriType
            + " p=" + (path.isEmpty() ? "-" : path)
            + " r=" + (reason.isEmpty() ? "-" : reason)
            + " ex=" + (ex.isEmpty() ? "-" : ex)
            + " main=" + (onMain ? 1 : 0);
    }

    private static JSONObject buildAndPlaySound(
        Context context,
        int ringerMode,
        int alarmVolume,
        int notifVolume
    ) {
        JSONObject dbg = new JSONObject();
        try {
            dbg.put("ringerMode", ringerMode);
            dbg.put("alarmVolume", alarmVolume);
            dbg.put("notifVolume", notifVolume);
            dbg.put("onMain", Looper.myLooper() == Looper.getMainLooper());
        } catch (Exception ignored) {
            // ignore
        }

        if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
            try {
                dbg.put("playedSound", false);
                dbg.put("reason", "ringer_silent");
            } catch (Exception ignored) {
                // ignore
            }
            return dbg;
        }

        if (alarmVolume <= 0 && notifVolume <= 0) {
            try {
                dbg.put("playedSound", false);
                dbg.put("reason", "both_streams_muted");
            } catch (Exception ignored) {
                // ignore
            }
            return dbg;
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
            try {
                dbg.put("playedSound", false);
                dbg.put("reason", "no_default_uri");
            } catch (Exception ignored) {
                // ignore
            }
            return dbg;
        }

        try {
            dbg.put("uriType", uriType);
            dbg.put("uri", String.valueOf(uri));
        } catch (Exception ignored) {
            // ignore
        }

        final int stream = (alarmVolume > 0) ? AudioManager.STREAM_ALARM : AudioManager.STREAM_NOTIFICATION;
        try {
            dbg.put("stream", stream);
        } catch (Exception ignored) {
            // ignore
        }

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
                    dbg.put("playedSound", true);
                    dbg.put("path", "mediaplayer");
                    return dbg;
                }
                dbg.put("path", "mediaplayer_null");
            }

            Ringtone ringtone = RingtoneManager.getRingtone(context.getApplicationContext(), uri);
            if (ringtone == null) {
                dbg.put("playedSound", false);
                dbg.put("reason", "ringtone_null");
                return dbg;
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
            dbg.put("playedSound", true);
            dbg.put("path", "ringtone");
            return dbg;
        } catch (Exception ex) {
            try {
                dbg.put("playedSound", false);
                dbg.put("reason", "exception");
                dbg.put("ex", ex.getClass().getSimpleName());
            } catch (Exception ignored) {
                // ignore
            }
            return dbg;
        }
    }

    private static void logFeedback(
        Context context,
        String source,
        int ringerMode,
        int notifVolume,
        int alarmVolume,
        boolean playedSound,
        boolean vibrated,
        JSONObject sound
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
            dbg.put("sound", sound);
            PickupDebugNative.log(context, "H-SOUND", "PickupAlertFeedback.alert", "pickup feedback", dbg);
        } catch (Exception ignored) {
            // ignore
        }
    }
}
