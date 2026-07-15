export interface OfflinePrintConfigDto {
  defaultBillPrinterId?: string | null;
  agentLocalBaseUrl?: string | null;
  localPrintAuthToken?: string | null;
  agentId?: string | null;
  fromHeartbeatUtc?: string | null;
  fiscalPrintingEnabled?: boolean;
  defaultFiscalPrinterId?: string | null;
  fiscalVatGroupMapping?: Record<string, number> | null;
}

export interface OfflinePrintConfigStored extends OfflinePrintConfigDto {
  restaurantId: string;
  cachedAtUtc: string;
}

export function offlinePrintStorageKey(restaurantId: string): string {
  return `qrfe-offline-print-config:${restaurantId}`;
}
