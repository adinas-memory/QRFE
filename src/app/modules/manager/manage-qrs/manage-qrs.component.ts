import { QrCodeUrl } from '../../../core/models/QRs/qr.models';
import { AuthService } from './../../../core/auth/auth.service';
import { QrCodesService } from './../../../core/services/qr-service/qr-codes.service';
import { Component } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { NgFor } from '@angular/common';
import { ContainerComponent, ButtonDirective, CardBodyComponent, RowComponent, ColComponent,
   CardComponent, CardImgDirective, CardTextDirective, CardTitleDirective } from '@coreui/angular';

@Component({
  selector: 'app-manage-qrs',
  imports: [NgFor, QRCodeComponent, ContainerComponent, CardComponent,
     CardImgDirective, CardBodyComponent, CardTitleDirective, CardTextDirective,
      ButtonDirective, RowComponent, ColComponent],
  standalone: true,
  templateUrl: './manage-qrs.component.html'
})
export class ManageQrsComponent {

  qrCodes: QrCodeUrl[] = [];
  restaurantId: string = '';

  constructor(private qrService: QrCodesService,
    private authService: AuthService) { }


  ngOnInit(): void {
    this.authService.getUserContext().subscribe({
      next: (user) => {
        this.restaurantId = user?.restaurantId as string;
        if (this.restaurantId) {
          this.loadQrCodes();
        }
      },
      error: (err) => {
        console.error('Error fetching user context:', err);
      }
    });
  }

  loadQrCodes(): void {
    this.qrService.getQrCodes(this.restaurantId).subscribe({
      next: (response: any) => {
        console.log('Full response from backend:', response);
        if ('qRsUrl' in response && Array.isArray(response.qRsUrl)) {
          this.qrCodes = response.qRsUrl;
        } else {
          console.warn('qRsUrl not found in response');
        }
      },
      error: (error) => {
        console.error('Error fetching QR Codes:', error);
      }
    });
  }

  printQrCards(): void {
    window.print();
  }


}
