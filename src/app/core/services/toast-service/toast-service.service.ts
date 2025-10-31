import { Injectable } from '@angular/core';
import { ToasterService } from '@coreui/angular';



@Injectable({ providedIn: 'root' })
export class AppToastService {
  constructor(private toaster: ToasterService) {}
private current: any[] = [];
  private push(toast:any) {
    const current = this.toaster.toasterState$.subscribe(state => {
      state ?? [];
    });
    this.toaster.setState(toast);
  }

  success(message: string, title = 'Success') {
    this.push({
      title,
      body: message,   // use `body`, not `message`
      color: 'success',
      autohide: true,
      delay: 3000
    });
  }

  error(message: string, title = 'Error') {
    this.push({
      title,
      body: message,
      color: 'danger',
      autohide: true,
      delay: 5000
    });
  }
}

