package com.universal_restaurant_system.pos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class NetworkMonitorService extends Service {

    public static final String CHANNEL_ID = "network_monitor_v1";
    private static final int NOTIFICATION_ID = 41001;

    // Doze/App Standby suspends the main-thread Handler and throttles network I/O on screen-off,
    // even inside a foreground service, unless the process holds a CPU wake lock (confirmed by
    // H_B2_2 heartbeat gaps growing from ~3s to 30s+ while documentHidden=true in debug-e48331.log).
    private PowerManager.WakeLock wakeLock;

    // #region agent log
    private final Handler debugHeartbeatHandler = new Handler(Looper.getMainLooper());
    private final Runnable debugHeartbeatRunnable = new Runnable() {
        @Override
        public void run() {
            boolean held = wakeLock != null && wakeLock.isHeld();
            DebugFileLogger.log(
                getApplicationContext(), "H_B2_2", "NetworkMonitorService.java", "native service heartbeat",
                "{\"wakeLockHeld\":" + held + "}"
            );
            debugHeartbeatHandler.postDelayed(this, 3000);
        }
    };
    // #endregion

    public interface NetworkListener {
        void onNetworkAvailable();
        void onNetworkLost();
    }

    private static NetworkListener networkListener;

    public static void setNetworkListener(NetworkListener listener) {
        networkListener = listener;
    }

    private ConnectivityManager.NetworkCallback networkCallback;

    @Override
    public void onCreate() {
        super.onCreate();
        ensureNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        acquireWakeLock();
        // #region agent log
        debugHeartbeatHandler.postDelayed(debugHeartbeatRunnable, 3000);
        // #endregion

        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm == null) {
            return;
        }

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                // #region agent log
                DebugFileLogger.log(
                    getApplicationContext(), "H_B2_1", "NetworkMonitorService.java",
                    "ConnectivityManager onAvailable", "{}"
                );
                // #endregion
                if (networkListener != null) {
                    networkListener.onNetworkAvailable();
                }
            }

            @Override
            public void onLost(Network network) {
                // #region agent log
                DebugFileLogger.log(
                    getApplicationContext(), "H_B2_1", "NetworkMonitorService.java",
                    "ConnectivityManager onLost", "{}"
                );
                // #endregion
                if (networkListener != null) {
                    networkListener.onNetworkLost();
                }
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
        cm.registerNetworkCallback(request, networkCallback);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        // #region agent log
        debugHeartbeatHandler.removeCallbacks(debugHeartbeatRunnable);
        // #endregion
        releaseWakeLock();
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm != null && networkCallback != null) {
            try {
                cm.unregisterNetworkCallback(networkCallback);
            } catch (Exception ignored) {
                // ignore
            }
        }
        networkCallback = null;
        super.onDestroy();
    }

    private void acquireWakeLock() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager == null) {
                return;
            }
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "QRFE:NetworkMonitor");
            wakeLock.setReferenceCounted(false);
            // 10h ceiling as a safety net; renewed by re-acquiring on every service (re)start.
            wakeLock.acquire(10 * 60 * 60 * 1000L);
        } catch (Exception ignored) {
            // best-effort: connectivity still works without it, just subject to Doze throttling
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {
            // ignore
        }
        wakeLock = null;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Network monitor",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Keeps POS connectivity monitoring active");
        nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText("Monitoring restaurant connectivity")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
