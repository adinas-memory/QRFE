import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  apiUrl: 'https://universalrestaurant.systems',
  publicSiteUrl: 'https://universalrestaurant.systems',
  poweredBy: 'QRFE Prod Server',
  /**
   * Stable "latest" asset URL — keep the same filename on every GitHub Release.
   * Replace OWNER/REPO with your Printer-Agent repository after the first release.
   */
  printerAgentDownloadUrl:
    'https://github.com/adrian-badulescu/Printer-Agent/releases/download/v1.4.2/URSPrinterAgentSetup.exe',
  posApkDownloadUrl:
    'https://github.com/adrian-badulescu/QRFE/releases/latest/download/URS-POS-prod.apk',
};
