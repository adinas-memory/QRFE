import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CreateReservationRequest {
  customerName: string;
  phone: string;
  partySize: number;
  tableId: string;
  /** RFC3339 cu offset local, ex. 2026-04-18T19:00:00+03:00 */
  start: string;
}

export interface CreateReservationResponse {
  eventId: string;
}

export interface AvailabilityResponse {
  available: boolean;
}

export interface ReservationItem {
  reservationId: string;
  tableId: string;
  tableLabel: string;
  customerName: string;
  phone: string;
  partySize: number;
  start: string;
  end: string;
  status: string;
}

export interface ReservationTableOption {
  tableId: string;
  label: string;
}

export interface ListReservationsQuery {
  from?: string;
  to?: string;
  includeCancelled?: boolean;
  skip?: number;
  take?: number;
}

@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  list(restaurantId: string, query: ListReservationsQuery = {}): Observable<ReservationItem[]> {
    let params = new HttpParams();
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.includeCancelled != null) params = params.set('includeCancelled', String(query.includeCancelled));
    if (query.skip != null) params = params.set('skip', String(query.skip));
    if (query.take != null) params = params.set('take', String(query.take));

    return this.http.get<ReservationItem[]>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations`,
      { params, withCredentials: true }
    );
  }

  getById(restaurantId: string, reservationId: string): Observable<ReservationItem> {
    return this.http.get<ReservationItem>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations/${encodeURIComponent(reservationId)}`,
      { withCredentials: true }
    );
  }

  listTablesForReservations(restaurantId: string): Observable<ReservationTableOption[]> {
    return this.http.get<ReservationTableOption[]>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations/tables`,
      { withCredentials: true }
    );
  }

  getAvailability(restaurantId: string, tableId: string, start: string): Observable<AvailabilityResponse> {
    const params = new HttpParams().set('tableId', tableId).set('start', start);
    return this.http.get<AvailabilityResponse>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations/availability`,
      { params, withCredentials: true }
    );
  }

  create(restaurantId: string, body: CreateReservationRequest): Observable<CreateReservationResponse> {
    return this.http.post<CreateReservationResponse>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations`,
      body,
      { withCredentials: true }
    );
  }

  update(restaurantId: string, eventId: string, body: CreateReservationRequest): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations/${encodeURIComponent(eventId)}`,
      body,
      { withCredentials: true }
    );
  }

  delete(restaurantId: string, eventId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/api/public/${restaurantId}/reservations/${encodeURIComponent(eventId)}`,
      { withCredentials: true }
    );
  }
}
