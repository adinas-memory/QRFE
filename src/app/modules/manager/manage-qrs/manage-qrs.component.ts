import { QrCodeUrl, RenewQrCodesResponse } from '../../../core/models/QRs/qr.models';
import { AuthService } from './../../../core/auth/auth.service';
import { QrCodesService } from './../../../core/services/qr-service/qr-codes.service';
import { Component } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { NgFor } from '@angular/common';
import {
  ContainerComponent, ButtonDirective, CardBodyComponent, RowComponent, ColComponent,
  CardComponent, CardImgDirective, CardTextDirective, CardTitleDirective, Tabs2Module,
  TabContentComponent
} from '@coreui/angular';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';

@Component({
  selector: 'app-manage-qrs',
  imports: [NgFor, QRCodeComponent, ContainerComponent, CardComponent,
    CardImgDirective, CardBodyComponent, CardTitleDirective, CardTextDirective,
    ButtonDirective, RowComponent, ColComponent, Tabs2Module, TabContentComponent,],
  standalone: true,
  templateUrl: './manage-qrs.component.html'
})
export class ManageQrsComponent {

  qrCodes: QrCodeUrl[] = [];
  restaurantId: string = '';

  constructor(private qrService: QrCodesService,
    private authService: AuthService,
    private appToast: AppToastService,) { }


  ngOnInit(): void {
    this.authService.getUserContext().subscribe({
      next: (user) => {
        this.restaurantId = user?.restaurantId as string;
        if (this.restaurantId) {
          this.loadQrCodes();
        }
      },
      error: (err) => {
        this.appToast.error(`Error fetching user context: ${err?.Message}`);
      }
    });
  }

  loadQrCodes(): void {
    this.qrService.getQrCodes(this.restaurantId).subscribe({
      next: (response: any) => {
        if ('qRsUrl' in response && Array.isArray(response.qRsUrl)) {
          this.qrCodes = response.qRsUrl;
        } else {
          console.warn('qRsUrl not found in response');
        }
      },
      error: (error) => {
        this.appToast.error(`Error fetching QR Codes: ${error?.Message}`);        
      }
    });
  }

  renewQrCodes(): void {
    const confirmed = window.confirm('Sei sicuro di voler rinnovare i codici QR?');

    if (!confirmed) {
      return; // utilizatorul a anulat
    }

    this.qrService.renewQrCodes(this.restaurantId).subscribe({
      next: (response: any) => {
        this.loadQrCodes();
      },
      error: (error) => {
        this.appToast.error(`Error renewing QR Codes: ${error?.Message}`);        
      }
    });
  }



  printQrCards(): void {
    window.print();
  }


}
