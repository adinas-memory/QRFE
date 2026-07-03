import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: 'http://localhost:7051',
  publicSiteUrl: 'http://localhost:4200',
  poweredBy: 'QRFE Dev Server',
  /** GitHub Releases URSPrinterAgentSetup.exe (Burn installer; empty = FAQ shows linkUnset). */
  printerAgentDownloadUrl: 'https://github.com/adrian-badulescu/Printer-Agent/releases/download/v1.4.2/URSPrinterAgentSetup.exe',
};
