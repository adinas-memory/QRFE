import { Injectable, inject } from '@angular/core';
import { OfflinePrintContextService } from './offline-print-context.service';

export interface LocalBillPrintPayload {
  type: 'bill';
  orderId: string;
  restaurantName: string;
  tableName: string | null;
  currency: string | null;
  subTotal: number;
  finalTotal: number;
  paymentMethod: string;
  closedAtUtc: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
}

export interface LocalFiscalPrintPayload {
  type: 'fiscal-receipt';
  orderId: string;
  restaurantName: string;
  tableName: string | null;
  currency: string | null;
  subTotal: number;
  finalTotal: number;
  paymentMethod: string;
  closedAtUtc: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    vatPercent?: number | null;
    vatGroup?: number;
  }>;
}

export interface LocalFiscalCommandPayload {
  type: 'fiscal-command';
  command: 'open-drawer';
}

@Injectable({ providedIn: 'root' })
export class OfflinePrintService {
  private readonly context = inject(OfflinePrintContextService);

  async printBillSync(args: {
    restaurantId: string;
    printerId: string;
    payload: LocalBillPrintPayload;
  }): Promise<void> {
    await this.postLocalPrintJob(args.restaurantId, args.printerId, args.payload);
  }

  async printFiscalReceiptSync(args: {
    restaurantId: string;
    printerId: string;
    payload: LocalFiscalPrintPayload;
  }): Promise<void> {
    await this.postLocalPrintJob(args.restaurantId, args.printerId, args.payload);
  }

  async printFiscalCommandSync(args: {
    restaurantId: string;
    printerId: string;
    payload: LocalFiscalCommandPayload;
  }): Promise<void> {
    await this.postLocalPrintJob(args.restaurantId, args.printerId, args.payload);
  }

  private async postLocalPrintJob(
    restaurantId: string,
    printerId: string,
    payload: LocalBillPrintPayload | LocalFiscalPrintPayload | LocalFiscalCommandPayload,
  ): Promise<void> {
    const baseUrl = this.context.getAgentLocalBaseUrl()?.replace(/\/$/, '');
    // #region agent log
    fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b7cb8'},body:JSON.stringify({sessionId:'6b7cb8',runId:'pre-fix',hypothesisId:'H1',location:'offline-print.service.ts:postLocalPrintJob',message:'offline local print attempt',data:{baseUrl:baseUrl??null,printerId,payloadType:payload.type,ready:this.context.isReadyForOfflineFiscalPrint()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!baseUrl) {
      throw new Error('Offline print agent URL not configured.');
    }

    const token = this.context.getLocalPrintAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    try {
      const res = await fetch(`${baseUrl}/local/print-jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ restaurantId, printerId, payload }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b7cb8'},body:JSON.stringify({sessionId:'6b7cb8',runId:'pre-fix',hypothesisId:'H5',location:'offline-print.service.ts:postLocalPrintJob:failed',message:'local print http error',data:{status:res.status,baseUrl,printerId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw new Error(`Local print failed: HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
