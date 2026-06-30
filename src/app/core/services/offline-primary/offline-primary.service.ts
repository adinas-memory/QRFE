import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface RestaurantStaffListItem {
  userId: string;
  email: string;
  displayName: string;
}

export interface OfflinePrimaryStaffPolicy {
  offlinePrimaryStaffUserId: string | null;
  email?: string | null;
  offlinePrimaryClientInstanceId?: string | null;
  deviceBound: boolean;
}

export interface BindOfflinePrimaryDeviceResponse {
  isOfflinePrimaryDevice: boolean;
}

@Injectable({ providedIn: 'root' })
export class OfflinePrimaryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  listStaff(restaurantId: string): Observable<RestaurantStaffListItem[]> {
    return this.http.get<RestaurantStaffListItem[]>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/staff`,
      { withCredentials: true },
    );
  }

  getPolicy(restaurantId: string): Observable<OfflinePrimaryStaffPolicy> {
    return this.http.get<OfflinePrimaryStaffPolicy>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/offline-primary-staff`,
      { withCredentials: true },
    );
  }

  updatePolicy(
    restaurantId: string,
    offlinePrimaryStaffUserId: string | null,
  ): Observable<OfflinePrimaryStaffPolicy> {
    return this.http.patch<OfflinePrimaryStaffPolicy>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/admin/offline-primary-staff`,
      { offlinePrimaryStaffUserId },
      { withCredentials: true },
    );
  }

  bindDevice(restaurantId: string): Observable<BindOfflinePrimaryDeviceResponse> {
    return this.http.post<BindOfflinePrimaryDeviceResponse>(
      `${this.apiUrl}/api/restaurants/${restaurantId}/staff/offline-primary/bind-device`,
      {},
      { withCredentials: true },
    );
  }
}
