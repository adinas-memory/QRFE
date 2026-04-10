import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastComponent, ToastHeaderComponent, ToastBodyComponent } from '@coreui/angular';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { AsyncPipe, NgFor } from '@angular/common';
import { Observable } from 'rxjs';
import { AppToast } from '../../../core/models/toastModel';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule, ToastComponent, ToastHeaderComponent, ToastBodyComponent, NgFor, AsyncPipe],
  templateUrl: './app-toast.component.html',
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1200;
      width: 320px;
    }
  `]
})
export class AppToastsComponent implements OnInit {
    toasts$!: Observable<AppToast[]>;
  
  constructor(public toastService: AppToastService) {}

  ngOnInit(): void {
    this.toasts$ = this.toastService.toasts$;
  }  
}
