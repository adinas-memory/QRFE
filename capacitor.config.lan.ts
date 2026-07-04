import type { CapacitorConfig } from '@capacitor/cli';

/**
 * LAN tablet debug — copy over capacitor.config.ts before sync, or use `npm run android:lan`.
 * Do not ship release APK with this config.
 */
const config: CapacitorConfig = {
  appId: 'com.universal_restaurant_system.pos',
  appName: 'U.R.S. Staff',
  webDir: 'dist/browser',
  server: {
    url: 'http://192.168.43.142',
    cleartext: true,
    androidScheme: 'http',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: [],
    },
  },
};

export default config;
