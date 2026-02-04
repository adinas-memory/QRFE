import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';
import { VenueSizeConfigList } from '../../models/venueSizeConfigModel';

@Injectable({
  providedIn: 'root'
})
export class MiscellaneousService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCurrencies(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/api/restaurants/currencies`);
  }

  getRestaurantLimits(): Observable<VenueSizeConfigList> {
    return this.http.get<VenueSizeConfigList>(`${this.apiUrl}/api/user/restaurant-limits`);
  }
  
}
