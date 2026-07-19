import { Component, inject } from '@angular/core';
import { PwaUpdateService } from '../../../core/pwa/pwa-update.service';

/**
 * PWA updates apply silently when no open orders exist.
 * Host kept so AppComponent can inject lifecycle without a blocking modal.
 */
@Component({
  selector: 'app-pwa-update-prompt',
  standalone: true,
  template: '',
})
export class PwaUpdatePromptComponent {
  readonly pwa = inject(PwaUpdateService);
}
