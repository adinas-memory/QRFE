import { Component, inject } from '@angular/core';
import {
  AlertComponent,
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PwaUpdateService } from '../../../core/pwa/pwa-update.service';

@Component({
  selector: 'app-pwa-update-prompt',
  standalone: true,
  templateUrl: './pwa-update-prompt.component.html',
  imports: [
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    AlertComponent,
    TranslocoPipe
  ]
})
export class PwaUpdatePromptComponent {
  readonly pwa = inject(PwaUpdateService);
}
