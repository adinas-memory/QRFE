import type { CapacitorConfig } from '@capacitor/cli';

const lanApk = process.env['CAPACITOR_LAN_APK'] === '1';
const lanLive = process.env['CAPACITOR_LAN_LIVE'] === '1';
const lanIp = process.env['CAPACITOR_LAN_IP'] ?? '192.168.43.142';

const config: CapacitorConfig = {
  appId: 'com.universal_restaurant_system.pos',
  appName: 'U.R.S. Staff',
  webDir: 'dist/browser',
  ...(lanApk
    ? {
        server: {
          androidScheme: 'http',
          cleartext: true,
        },
      }
    : lanLive
      ? {
          server: {
            url: `http://${lanIp}`,
            cleartext: true,
            androidScheme: 'http',
          },
        }
      : {}),
  plugins: {
    PushNotifications: {
      // Foreground: no OS banner (SSE handles haptics + in-app toast). Background: hybrid FCM shows tray.
      presentationOptions: [],
    },
  },
};

export default config;
