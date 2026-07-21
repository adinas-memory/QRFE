import type { Environment } from './environment.model';

/** LAN tablet debug only — use `npm run build:capacitor-lan`, not release APK. */
export const environment: Environment = {
  production: true,
  apiUrl: 'http://192.168.43.142',
  publicSiteUrl: 'http://192.168.43.142',
  poweredBy: 'QRFE Capacitor LAN',
  printerAgentDownloadUrl:
    'https://github.com/adrian-badulescu/Printer-Agent/releases/latest/download/URSPrinterAgentSetup.exe',
  posApkDownloadUrl:
    'https://github.com/adrian-badulescu/URS-android/releases/latest/download/URS-POS-prod.apk',
};
