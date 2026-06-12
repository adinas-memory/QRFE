import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { filter, take } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAssignedRestaurantId, normalizeRestaurantId } from '../../../core/auth/restaurant-id.util';
import { QrCodesService } from '../../../core/services/qr-service/qr-codes.service';
import { QrCodeUrl } from '../../../core/models/QRs/qr.models';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent } from '@coreui/angular';

@Component({
  selector: 'app-manage-qrs-links',
  standalone: true,
  imports: [RouterLink, ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent],
  templateUrl: './manage-qrs-links.component.html',
})
export class ManageQrsLinksComponent implements OnInit {
  restaurantId = '';
  loading = true;
  items: QrCodeUrl[] = [];

  constructor(
    private authService: AuthService,
    private qrService: QrCodesService,
    private appToast: AppToastService,
  ) {}

  ngOnInit(): void {
    this.authService.getUserContext().pipe(
      filter(user => isAssignedRestaurantId(normalizeRestaurantId(user?.restaurantId ?? null) ?? null)),
      take(1),
    ).subscribe(user => {
      this.restaurantId = normalizeRestaurantId(user!.restaurantId)!;
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.qrService.getQrCodes(this.restaurantId).subscribe({
      next: (res) => {
        const list = this.extractQrList(res);
        this.items = [...list].sort((a, b) => (a.tableLabel ?? '').localeCompare(b.tableLabel ?? ''));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private extractQrList(response: unknown): QrCodeUrl[] {
    if (!response || typeof response !== 'object') {
      return [];
    }
    const raw = response as Record<string, unknown>;
    const list = raw['qRsUrl'] ?? raw['QRsUrl'];
    return Array.isArray(list) ? (list as QrCodeUrl[]) : [];
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.appToast.success('Copied.');
    } catch {
      this.appToast.error('Copy failed.');
    }
  }
}
