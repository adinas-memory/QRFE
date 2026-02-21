import { Injectable, NgZone } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { MenuItem } from '../../models/menu/menuItem';
import { CartItem } from '../../models/orderingModel';
import { OrderItemDTO } from '../../models/orderingModel';
import { OrdersService } from './orders.service';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { environment } from '../../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class OrderSyncService {

  private apiUrl = environment.apiUrl;

  constructor(private ngZone: NgZone) {
  }

  listenToRestaurantEvents(restaurantId: string): Observable<{ EventType: string, Data: any }> {
    return new Observable(observer => {
      const controller = new AbortController();

      fetchEventSource(`${this.apiUrl}/sse/internal/restaurant/${restaurantId}`, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,

        onmessage: (msg: any) => {
          this.ngZone.run(() => {

            const raw = JSON.parse(msg.data);

            const EventType = raw.EventType ?? raw.event;

            const Data = typeof raw.Data === 'string'
              ? JSON.parse(raw.Data)
              : raw.Data;
            observer.next({ EventType, Data });
          });
        },


        onerror: err => {
          this.ngZone.run(() => observer.error(err));
        }
      });

      return () => controller.abort();
    });
  }





}
