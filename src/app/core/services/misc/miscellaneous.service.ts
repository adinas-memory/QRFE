import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MiscellaneousService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCurrencies() {
    return this.http.get<{ [key: string]: number }>(`${this.apiUrl}/api/misc/currency-rates`);
  }

  
}
