import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private counter = 0;
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();
  

  show() {
    this.counter++;
    this._loading.next(true);
    this.loading$.subscribe(v => console.log("SPINNER STATE =", v));
  }

  hide() {
    this.counter--;
    if (this.counter <= 0) {
      this.counter = 0;
      this._loading.next(false);
      this.loading$.subscribe(v => console.log("SPINNER STATE =", v));
    }
  }
}
