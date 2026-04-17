import { Injectable, signal } from '@angular/core';

/** Controls feedback modal visibility; modal is rendered outside the header to avoid z-index/backdrop stacking issues. */
@Injectable({ providedIn: 'root' })
export class FeedbackUiService {
  private readonly _modalVisible = signal(false);
  readonly modalVisible = this._modalVisible.asReadonly();

  openModal(): void {
    this._modalVisible.set(true);
  }

  closeModal(): void {
    this._modalVisible.set(false);
  }

  setModalVisible(visible: boolean): void {
    this._modalVisible.set(visible);
  }
}
