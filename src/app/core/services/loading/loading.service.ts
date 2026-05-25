import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private counter = 0;
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();

  show(method?: string, url?: string): void {
    this.counter++;
    this._loading.next(true);
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'nav-fix',location:'loading.service.ts:show',message:'loading show',data:{counter:this.counter,method,url:truncateUrl(url)},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
    // #endregion
  }

  /** Clears a stuck global spinner (e.g. after route change). */
  reset(reason?: string): void {
    const prev = this.counter;
    this.counter = 0;
    this._loading.next(false);
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'nav-fix',location:'loading.service.ts:reset',message:'loading reset',data:{prevCounter:prev,reason},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
  }

  hide(method?: string, url?: string): void {
    this.counter--;
    const visible = this.counter > 0;
    if (this.counter <= 0) {
      this.counter = 0;
      this._loading.next(false);
    }
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',runId:'nav-fix',location:'loading.service.ts:hide',message:'loading hide',data:{counter:this.counter,visible,method,url:truncateUrl(url)},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
    // #endregion
  }
}

function truncateUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const i = url.indexOf('?');
  return i >= 0 ? url.slice(0, i) : url;
}
