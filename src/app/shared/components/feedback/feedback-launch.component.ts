import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonDirective } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '@app/core/auth/auth.service';
import { FeedbackUiService } from '@app/core/services/feedback/feedback-ui.service';

/** Header button only; modal lives in {@link FeedbackModalComponent} at layout root. */
@Component({
  selector: 'app-feedback-launch',
  standalone: true,
  templateUrl: './feedback-launch.component.html',
  imports: [ButtonDirective, IconDirective]
})
export class FeedbackLaunchComponent {
  private readonly auth = inject(AuthService);
  private readonly feedbackUi = inject(FeedbackUiService);

  readonly user = toSignal(this.auth.user$, { initialValue: this.auth.getUserSnapshot() });
  readonly isLoggedIn = computed(() => this.user() != null);

  open(): void {
    this.feedbackUi.openModal();
  }
}
