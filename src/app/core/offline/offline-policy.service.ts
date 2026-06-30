import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { OnlineStateService } from './online-state-service';

@Injectable({ providedIn: 'root' })
export class OfflinePolicyService {
  private readonly auth = inject(AuthService);
  private readonly onlineState = inject(OnlineStateService);

  private readonly user = toSignal(this.auth.user$, { initialValue: null });
  private readonly isOnline = toSignal(this.onlineState.online$, { initialValue: this.onlineState.isOnline });

  readonly isOfflinePrimaryDevice = computed(
    () => this.user()?.isOfflinePrimaryDevice === true,
  );

  readonly isOfflinePrimaryStaffDesignee = computed(
    () => this.user()?.isOfflinePrimaryStaffDesignee === true,
  );

  readonly canUseFullOffline = computed(
    () => !this.isOnline() && this.isOfflinePrimaryDevice(),
  );

  readonly shouldShowBindDeviceCta = computed(
    () =>
      this.isOnline()
      && this.isOfflinePrimaryStaffDesignee()
      && !this.isOfflinePrimaryDevice(),
  );
}
