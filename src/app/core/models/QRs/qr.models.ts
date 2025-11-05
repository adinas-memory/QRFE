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
