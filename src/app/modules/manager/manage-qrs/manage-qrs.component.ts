import { QrCodeUrl } from '../../../core/models/QRs/qr.models';
import { AuthService } from './../../../core/auth/auth.service';
import { isAssignedRestaurantId, normalizeRestaurantId } from '../../../core/auth/restaurant-id.util';
import { QrCodesService } from './../../../core/services/qr-service/qr-codes.service';
import { Component, OnInit } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { RouterLink } from '@angular/router';
import { filter, take } from 'rxjs';
import {
  ContainerComponent, ButtonDirective, CardBodyComponent, RowComponent, ColComponent,
  CardComponent, CardTextDirective, CardTitleDirective, Tabs2Module,
  TabContentComponent, AlertComponent
} from '@coreui/angular';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';

@Component({
  selector: 'app-manage-qrs',
  imports: [QRCodeComponent, ContainerComponent, CardComponent,
    CardBodyComponent, CardTitleDirective, CardTextDirective,
    ButtonDirective, RowComponent, ColComponent, Tabs2Module, TabContentComponent, RouterLink, AlertComponent],
  standalone: true,
  templateUrl: './manage-qrs.component.html'
})
export class ManageQrsComponent implements OnInit {

  qrCodes: QrCodeUrl[] = [];
  restaurantId = '';
  loaded = false;

  constructor(
    private qrService: QrCodesService,
    private authService: AuthService,
    private appToast: AppToastService,
    private misc: MiscellaneousService,
  ) { }

  ngOnInit(): void {
    this.authService.getUserContext().pipe(
      filter(user => isAssignedRestaurantId(normalizeRestaurantId(user?.restaurantId ?? null) ?? null)),
      take(1),
    ).subscribe(user => {
      this.restaurantId = normalizeRestaurantId(user!.restaurantId)!;
      this.loadQrCodes();
    });
  }

  loadQrCodes(): void {
    this.loaded = false;
    this.qrService.getQrCodes(this.restaurantId).subscribe({
      next: (response) => {
        this.qrCodes = this.extractQrList(response);
        this.loaded = true;
      },
      error: () => {
        this.loaded = true;
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

  renewQrCodes(): void {
    const confirmed = window.confirm('Sei sicuro di voler rinnovare i codici QR?');

    if (!confirmed) {
      return;
    }

    this.qrService.renewQrCodes(this.restaurantId).subscribe({
      next: () => {
        this.loadQrCodes();
      },
      error: (error) => {
        this.appToast.error(this.misc.getFirstErrorMessage(error));
      }
    });
  }

  printQrCards(): void {
    window.print();
  }
}
