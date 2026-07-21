import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  // Use with http://localhost:8080 — api must be localhost (not LAN IP) for auth cookies.
  apiUrl: 'http://localhost:7051',
  publicSiteUrl: 'http://localhost:8080',
  poweredBy: 'QRFE PWA Test',
  posApkDownloadUrl:
    'https://github.com/adrian-badulescu/URS-android/releases/latest/download/URS-POS-prod.apk',
};

