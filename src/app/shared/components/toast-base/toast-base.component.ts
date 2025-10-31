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
  imports: [ToastHeaderComponent, ToastSampleIconComponent, ToastBodyComponent, ToastCloseDirective, ProgressComponent],
  standalone: true,
    styles: [
    `
      :host {
        display: block;
        overflow: hidden;
      }
    `
  ],
  providers: [{ provide: ToastComponent, useExisting: forwardRef(() => ToastBaseComponent) }],
  templateUrl: './toast-base.component.html'
})
export class ToastBaseComponent extends ToastComponent{
    constructor() {
    super();
  }

  @Input() closeButton = true;
  @Input() title = '';
  @Input() message = '';

}
