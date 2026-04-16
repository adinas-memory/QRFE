import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RegisterStaffRequestModel } from '../../models/register-staff-request.model';
import { RegisterStaffResponseModel } from '../../models/register-staff-response.model';

@Injectable({ providedIn: 'root' })
export class StaffAdminService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * POST /api/restaurants/{restaurantId}/admin/register-staff
   */
  registerStaff(restaurantId: string, body: RegisterStaffRequestModel): Observable<RegisterStaffResponseModel> {
    return this.http.post<RegisterStaffResponseModel>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/register-staff`,
      body,
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
