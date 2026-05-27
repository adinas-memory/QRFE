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
    return () => this.endRequest(id);
  }

  private endRequest(id: number): void {
    this.inFlight.delete(id);
    this.emit();
  }

  /** Clears a stuck global spinner (e.g. after route change). */
  reset(_reason?: string): void {
    this.inFlight.clear();
    this.emit();
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
