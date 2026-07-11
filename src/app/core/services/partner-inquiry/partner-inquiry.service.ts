import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  SubmitPartnerInquiryPayload,
  SubmitPartnerInquiryResponse,
} from '../../models/partner-inquiry.model';

@Injectable({ providedIn: 'root' })
export class PartnerInquiryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  submit(payload: SubmitPartnerInquiryPayload): Observable<SubmitPartnerInquiryResponse> {
    return this.http.post<SubmitPartnerInquiryResponse>(
      `${this.apiUrl}/api/public/partner-inquiries`,
      payload,
    );
  }
}
