import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AppToast } from '../../models/toastModel';

@Injectable({ providedIn: 'root' })
export class AppToastService {
  private toastsSubject = new BehaviorSubject<AppToast[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();

  private get current() { return this.toastsSubject.value; }

  private pushToast(t: AppToast) {
    const list = [...this.current, t];
    this.toastsSubject.next(list);
    if (t.autohide) {
      setTimeout(() => this.remove(t.id), t.delay ?? 5000);
    }
  }

  success(message: string, title = 'Success', delay = 3000) {
    this.pushToast({
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      title,
      message,
      color: 'success',
      autohide: true,
      delay
    });
  }

  error(message: string, title = 'Error', delay = 5000) {
    this.pushToast({
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      title,
      message,
      color: 'danger',
      autohide: true,
      delay
    });
  }

  info(message: string, title = 'Info', delay = 3000) {
    this.pushToast({
      id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      title,
      message,
      color: 'info',
      autohide: true,
      delay
    });
  }

  remove(id: string) {
    const list = this.current.filter(t => t.id !== id);
    this.toastsSubject.next(list);
  }

  clear() {
    this.toastsSubject.next([]);
  }
}
