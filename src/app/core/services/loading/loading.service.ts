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
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
      body: JSON.stringify({
        sessionId: '7379f5',
        runId: 'spinner-fix',
        location: 'loading.service.ts:show',
        message: 'counter++',
        data: { counter: this.counter },
        timestamp: Date.now(),
        hypothesisId: 'H-S1',
      }),
    }).catch(() => {});
    // #endregion
  }

  /** Clears a stuck global spinner (e.g. after navigation). */
  reset(): void {
    this.counter = 0;
    this._loading.next(false);
  }

  hide() {
    this.counter--;
    if (this.counter <= 0) {
      this.counter = 0;
      this._loading.next(false);
    }
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
      body: JSON.stringify({
        sessionId: '7379f5',
        runId: 'spinner-fix',
        location: 'loading.service.ts:hide',
        message: 'counter--',
        data: { counter: this.counter, visible: this.counter > 0 },
        timestamp: Date.now(),
        hypothesisId: 'H-S1',
      }),
    }).catch(() => {});
    // #endregion
  }
}
