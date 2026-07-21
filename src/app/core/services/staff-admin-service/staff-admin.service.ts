import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RegisterStaffRequestModel } from '../../models/register-staff-request.model';
import { RegisterStaffResponseModel } from '../../models/register-staff-response.model';
import {
  RestaurantStaffListItem,
  StaffUserActionRequest
} from '../../models/restaurant-staff-list-item.model';

@Injectable({ providedIn: 'root' })
export class StaffAdminService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * GET /api/restaurants/{restaurantId}/admin/staff
   */
  listStaff(restaurantId: string): Observable<RestaurantStaffListItem[]> {
    return this.http.get<RestaurantStaffListItem[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/staff`,
      { withCredentials: true }
    );
  }

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

  /**
   * POST /api/restaurants/{restaurantId}/admin/disable-user
   */
  disableStaff(restaurantId: string, employeeId: string): Observable<boolean> {
    const body: StaffUserActionRequest = { employeeId };
    return this.http.post<boolean>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/disable-user`,
      body,
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * POST /api/restaurants/{restaurantId}/admin/enable-user
   */
  enableStaff(restaurantId: string, employeeId: string): Observable<boolean> {
    const body: StaffUserActionRequest = { employeeId };
    return this.http.post<boolean>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/enable-user`,
      body,
      { withCredentials: true, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
