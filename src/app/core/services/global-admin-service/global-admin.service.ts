import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateRestaurantRequest,
  DeleteRestaurantResponse,
  ListRestaurantsResponse,
  RestaurantDetailDTO,
  UpdateRestaurantRequest
} from '../../models/global-admin-restaurant.model';

@Injectable({ providedIn: 'root' })
export class GlobalAdminService {
  private readonly apiUrl = environment.apiUrl;
  private readonly base = `${this.apiUrl}/api/restaurants`;
  private readonly creds = { withCredentials: true };

  constructor(private http: HttpClient) {}

  listRestaurants(pageNumber: number, pageSize: number): Observable<ListRestaurantsResponse> {
    return this.http.get<ListRestaurantsResponse>(`${this.base}/${pageNumber}/${pageSize}`, this.creds);
  }

  getRestaurant(restaurantId: string): Observable<RestaurantDetailDTO> {
    return this.http.get<RestaurantDetailDTO>(`${this.base}/${restaurantId}`, this.creds);
  }

  createRestaurant(payload: CreateRestaurantRequest): Observable<RestaurantDetailDTO> {
    return this.http.post<RestaurantDetailDTO>(this.base, payload, this.creds);
  }

  updateRestaurant(id: string, payload: UpdateRestaurantRequest): Observable<RestaurantDetailDTO> {
    return this.http.put<RestaurantDetailDTO>(`${this.base}/${id}`, payload, this.creds);
  }

  deleteRestaurant(id: string): Observable<DeleteRestaurantResponse> {
    return this.http.delete<DeleteRestaurantResponse>(`${this.base}/${id}`, this.creds);
  }
}
