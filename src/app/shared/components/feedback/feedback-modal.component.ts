import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ButtonDirective,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective
} from '@coreui/angular';
import { FeedbackKind } from '@app/core/models/feedback.model';
import { FeedbackService } from '@app/core/services/feedback/feedback.service';
import { FeedbackUiService } from '@app/core/services/feedback/feedback-ui.service';
import { AppToastService } from '@app/core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '@app/core/services/misc/miscellaneous.service';

/** Rendered at layout root (not inside the sticky header) so the backdrop does not block the dialog. */
@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  templateUrl: './feedback-modal.component.html',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    ModalComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    FormLabelDirective,
    FormControlDirective,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective
  ]
})
export class FeedbackModalComponent {
  private readonly router = inject(Router);
  private readonly feedback = inject(FeedbackService);
  private readonly toast = inject(AppToastService);
  private readonly misc = inject(MiscellaneousService);
  private readonly fb = inject(FormBuilder);
  readonly ui = inject(FeedbackUiService);

  submitting = false;

  readonly FeedbackKind = FeedbackKind;

  readonly form = this.fb.nonNullable.group({
    kind: this.fb.nonNullable.control<FeedbackKind>(FeedbackKind.Bug),
    message: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(1000)])
  });

  get remainingChars(): number {
    return 1000 - (this.form.controls.message.value?.length ?? 0);
  }

  close(): void {
    this.ui.closeModal();
    this.submitting = false;
  }

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting = true;
    this.feedback
      .submit({
        kind: v.kind,
        message: v.message.trim(),
        routeContext: this.router.url
      })
      .subscribe({
        next: () => {
          this.toast.success('Thank you — your feedback was sent.', 'Feedback');
          this.form.reset({
            kind: FeedbackKind.Bug,
            message: ''
          });
          this.close();
        },
        error: err => {
          this.submitting = false;
          this.toast.error(this.misc.getFirstErrorMessage(err), 'Could not send feedback');
        }
      });
  }
}
