import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-payment-failure',
  standalone: true,
  imports: [ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, RouterLink, TranslocoPipe],
  templateUrl: './payment-failure.component.html',
  styleUrl: './payment-failure.component.scss'
})
export class PaymentFailureComponent {

}
