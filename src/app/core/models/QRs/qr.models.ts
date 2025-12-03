export interface QrCodeUrl {
  tableId: string;
  tableLabel: string;
  qrUrl: string;
}

export interface QrCodeResponse {
  restaurantId: string;
  restaurantName: string;
  keyVersion: number;
  generatedOn: string; // ISO string
  qRsUrl: QrCodeUrl[];
}

export interface RenewQrCodesResponse {
  restaurantId: string;
  keyVersion: number;
  validFrom: string; // ISO string
  validTo: string;   // ISO string
}
