import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { QrCodesService } from '../../../core/services/qr-service/qr-codes.service';
import { QrCodeUrl } from '../../../core/models/QRs/qr.models';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective } from '@coreui/angular';

@Component({
  selector: 'app-manage-qrs-links',
  standalone: true,
  imports: [NgFor, NgIf, ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective],
  templateUrl: './manage-qrs-links.component.html',
})
export class ManageQrsLinksComponent {
  restaurantId = '';
  loading = true;
  items: QrCodeUrl[] = [];

  constructor(
    private authService: AuthService,
    private qrService: QrCodesService,
    private appToast: AppToastService,
  ) {}

  ngOnInit(): void {
    this.authService.getUserContext().subscribe({
      next: (user) => {
        this.restaurantId = (user?.restaurantId ?? '') as string;
        if (!this.restaurantId) {
          this.loading = false;
          this.appToast.error('No restaurantId in user context.');
          return;
        }
        this.load();
      },
      error: (err) => {
        this.loading = false;
        this.appToast.error(`Error fetching user context: ${err?.Message ?? err}`);
      }
    });
  }

  load(): void {
    this.loading = true;
    this.qrService.getQrCodes(this.restaurantId).subscribe({
      next: (res) => {
        const list = (res?.qRsUrl ?? []) as QrCodeUrl[];
        this.items = [...list].sort((a, b) => (a.tableLabel ?? '').localeCompare(b.tableLabel ?? ''));
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.appToast.error(`Error fetching QR Codes: ${error?.Message ?? error}`);
      }
    });
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

