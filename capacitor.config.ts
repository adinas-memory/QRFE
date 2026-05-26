import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ro.unrsystem.qrfe.staff',
  appName: 'QR Staff',
  webDir: 'dist/browser',
  server: {
    url: 'http://192.168.43.142',
    cleartext: true,
    androidScheme: 'http',
  },
};

export default config;
