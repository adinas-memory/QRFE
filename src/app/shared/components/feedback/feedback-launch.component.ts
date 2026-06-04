import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonDirective, NavItemComponent } from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '@app/core/auth/auth.service';
import { FeedbackUiService } from '@app/core/services/feedback/feedback-ui.service';

export type FeedbackLaunchAppearance = 'nav-icon' | 'outline';

/** Header button only; modal lives in {@link FeedbackModalComponent} at layout root. */
@Component({
  selector: 'app-feedback-launch',
  standalone: true,
  templateUrl: './feedback-launch.component.html',
  imports: [ButtonDirective, NavItemComponent, IconDirective, TranslocoPipe]
})
export class FeedbackLaunchComponent {
  private readonly auth = inject(AuthService);
  private readonly feedbackUi = inject(FeedbackUiService);

  /** When true, show the launch control even if the user is not signed in (e.g. marketing landing). */
  readonly allowAnonymous = input(false);

  /** `nav-icon` matches manager header language/theme controls; `outline` matches landing header buttons. */
  readonly appearance = input<FeedbackLaunchAppearance>('nav-icon');

  /** Used when `appearance` is `outline` (landing header). */
  readonly outlineColor = input<'light' | 'dark'>('light');

  readonly user = toSignal(this.auth.user$, { initialValue: this.auth.getUserSnapshot() });
  readonly isLoggedIn = computed(() => this.user() != null);
  readonly showLaunch = computed(() => this.isLoggedIn() || this.allowAnonymous());

  open(): void {
    this.feedbackUi.openModal();
  }
}
