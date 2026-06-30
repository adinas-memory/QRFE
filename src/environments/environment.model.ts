/** Shared shape for all Angular environment files. */
export interface Environment {
  production: boolean;
  apiUrl: string;
  /** Canonical public site origin (no trailing slash), used for SEO canonical URLs. */
  publicSiteUrl: string;
  poweredBy: string;
  printerAgentDownloadUrl?: string;
  serviceWorker?: boolean;
}
