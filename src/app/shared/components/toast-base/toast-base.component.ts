import { Component, forwardRef, Input } from '@angular/core';
import {
  ProgressComponent,
  ToastBodyComponent,
  ToastCloseDirective,
  ToastComponent,
  ToastHeaderComponent
} from '@coreui/angular';
import { ToastSampleIconComponent } from '../toast-sample/toast-sample-icon/toast-sample-icon.component';

@Component({
  selector: 'app-toast-base',
  standalone: true,
  imports: [ToastHeaderComponent, ToastSampleIconComponent, ToastBodyComponent, ToastCloseDirective, ProgressComponent],
  styles: [`
    :host {
      display: block;
      overflow: hidden;
    }
  `],
  providers: [{ provide: ToastComponent, useExisting: forwardRef(() => ToastBaseComponent) }],
  template: `
    <c-toast-header [closeButton]="closeButton">
      <svg class="rounded me-2" width="20" height="20"
           xmlns="http://www.w3.org/2000/svg"
           preserveAspectRatio="xMidYMid slice"
           focusable="false" role="img">
        <rect width="100%" height="100%" [attr.fill]="iconColor" />
      </svg>
      <strong>{{ title }}</strong>
    </c-toast-header>
    <c-toast-body #toast [cToastClose]="toast.toast ?? undefined">
      <p class="mb-1">{{ message }}</p>
      <ng-content />
      <c-progress thin [value]="25 * (toast.toast?.clock ?? 1)" />
    </c-toast-body>
  `
})
export class ToastBaseComponent extends ToastComponent {
  constructor() { super(); }

  @Input() closeButton = true;
  @Input() title = '';
  @Input() message = '';

  /** Derivat din `color` (moștenit din ToastComponent) */
  get iconColor(): string {
    const map: Record<string, string> = {
      success: '#198754',
      danger:  '#dc3545',
      warning: '#ffc107',
      info:    '#0dcaf0',
      primary: '#0d6efd',
    };
    return map[this.color() ?? ''] ?? '#6c757d';
  }
}