import { Component } from '@angular/core';
import { LoadingService } from '../../../core/services/loading/loading.service';
import { AsyncPipe } from '@angular/common';
@Component({
  selector: 'app-spinner',
  imports: [AsyncPipe],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss'
})
export class SpinnerComponent {  
  loading$;
  constructor(private loadingService: LoadingService,) {
    this.loading$ = this.loadingService.loading$;
  }
}
