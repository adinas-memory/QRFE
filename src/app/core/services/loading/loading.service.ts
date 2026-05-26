import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private seq = 0;
  private readonly inFlight = new Set<number>();
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();

  /** Registers one in-flight HTTP operation; call the returned function in finalize. */
  beginRequest(_method?: string, _url?: string): () => void {
    const id = ++this.seq;
    this.inFlight.add(id);
    this.emit();
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'loading.service.ts:begin',message:'loading begin',data:{id,inFlight:this.inFlight.size},timestamp:Date.now(),hypothesisId:'H-COUNTER'})}).catch(()=>{});
    // #endregion
    return () => this.endRequest(id);
  }

  private endRequest(id: number): void {
    this.inFlight.delete(id);
    this.emit();
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'loading.service.ts:end',message:'loading end',data:{id,inFlight:this.inFlight.size,visible:this.inFlight.size>0},timestamp:Date.now(),hypothesisId:'H-COUNTER'})}).catch(()=>{});
    // #endregion
  }

  /** Clears a stuck global spinner (e.g. after route change). */
  reset(_reason?: string): void {
    const prev = this.inFlight.size;
    this.inFlight.clear();
    this.emit();
    // #region agent log
    fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'loading.service.ts:reset',message:'loading reset',data:{prevInFlight:prev},timestamp:Date.now(),hypothesisId:'H-NAV'})}).catch(()=>{});
    // #endregion
  }

  private emit(): void {
    this._loading.next(this.inFlight.size > 0);
  }

  /** @deprecated Use beginRequest(); kept for unit tests. */
  show(): void {
    this.beginRequest();
  }

  /** @deprecated Use beginRequest(); kept for unit tests. */
  hide(): void {
    if (this.inFlight.size > 0) {
      const first = this.inFlight.values().next().value;
      if (first !== undefined) {
        this.endRequest(first);
      }
    }
  }
}
