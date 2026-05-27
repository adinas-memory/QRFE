import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.universal_restaurant_system.pos',
  appName: 'U.R.S. Staff',
  webDir: 'dist/browser',
  server: {
    url: 'http://192.168.43.142',
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
