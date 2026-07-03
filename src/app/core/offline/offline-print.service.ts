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

@Injectable({ providedIn: 'root' })
export class OfflinePrintService {
  private readonly context = inject(OfflinePrintContextService);

  async printBillSync(args: {
    restaurantId: string;
    printerId: string;
    payload: LocalBillPrintPayload;
  }): Promise<void> {
    const baseUrl = this.context.getAgentLocalBaseUrl()?.replace(/\/$/, '');
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
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      // #region agent log
      fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ac8dee'},body:JSON.stringify({sessionId:'ac8dee',location:'offline-print.service.ts:printBillSync:preFetch',message:'local print fetch start',data:{baseUrl,hasToken:!!token,restaurantId:args.restaurantId,printerId:args.printerId},timestamp:Date.now(),hypothesisId:'H2-H3-H5'})}).catch(()=>{});
      // #endregion
      const res = await fetch(`${baseUrl}/local/print-jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          restaurantId: args.restaurantId,
          printerId: args.printerId,
          payload: args.payload,
        }),
        signal: controller.signal,
      });

      // #region agent log
      fetch('http://127.0.0.1:7341/ingest/5b84ace2-df1e-4f3a-9af6-330c89f47519',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ac8dee'},body:JSON.stringify({sessionId:'ac8dee',location:'offline-print.service.ts:printBillSync:postFetch',message:'local print fetch response',data:{status:res.status,ok:res.ok},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      if (!res.ok) {
        throw new Error(`Local print failed: HTTP ${res.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
