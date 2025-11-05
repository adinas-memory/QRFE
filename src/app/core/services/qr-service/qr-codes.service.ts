import { Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { HttpParams } from '@angular/common/http';
import { QrCodeResponse } from '../../models/QRs/qr.models';

@Injectable({
  providedIn: 'root'
})
export class QrCodesService {

  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {
  }

  getQrCodes(
    restaurantId: string,
    tableId?: string,
    allTables: boolean = true,
    version?: number
  ): Observable<QrCodeResponse> {
    let params = new HttpParams().set('allTables', allTables.toString());

    if (tableId) {
      params = params.set('tableId', tableId);
    }

    if (version !== undefined) {
      params = params.set('version', version.toString());
    }

    return this.http.post<QrCodeResponse>(`${this.apiUrl}/${restaurantId}`,{}, {
      params,
      withCredentials: true
    });
  }

  /**
 * Calls the backend to validate a QR code and follow its redirect.
 * @param qrUrl The full QR code URL to validate
 */
  // validateQrCodeViaBackend(qrUrl: string): Observable<string> {
  //   return this.http.get(qrUrl, {
  //     responseType: 'text',
  //     observe: 'response',
  //     withCredentials: true
  //   });
  // }

}
