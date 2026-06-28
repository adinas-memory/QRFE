export interface GlobalAdminPrinterFleetItem {
  restaurantId: string;
  restaurantName: string;
  agentId: string;
  agentVersion: string;
  agentLastHeartbeatUtc: string;
  agentOnline: boolean;
  printerId: string;
  printerName: string;
  ipAddress: string;
  port: number;
  printerStatus: string | null;
  isDefaultBillPrinter: boolean;
}
