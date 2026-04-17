import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SubmitFeedbackPayload, SubmitFeedbackResponse } from '../../models/feedback.model';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  submit(payload: SubmitFeedbackPayload): Observable<SubmitFeedbackResponse> {
    return this.http.post<SubmitFeedbackResponse>(
      `${this.apiUrl}/api/feedback`,
      payload,
      { withCredentials: true }
    );
  }
}
