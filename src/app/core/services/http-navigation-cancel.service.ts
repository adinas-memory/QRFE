import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/** Emits when in-flight HttpClient calls should be unsubscribed (route change). */
@Injectable({ providedIn: 'root' })
export class HttpNavigationCancelService {
  #cancel$ = new Subject<void>();

  cancelForRequest(): Observable<void> {
    return this.#cancel$.asObservable();
  }

  cancelAll(): void {
    this.#cancel$.next();
    this.#cancel$ = new Subject<void>();
  }
}
