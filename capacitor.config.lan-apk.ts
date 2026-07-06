import type { CapacitorConfig } from '@capacitor/cli';

/**
 * LAN standalone APK (bundled assets, no live reload).
 * WebView must use http scheme so fetch() to http://LAN_IP is not mixed-content blocked.
 */
const config: CapacitorConfig = {
  appId: 'com.universal_restaurant_system.pos',
  appName: 'U.R.S. Staff',
  webDir: 'dist/browser',
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: [],
    },
  },
};

export default config;
