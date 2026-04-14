import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RouterLink } from '@angular/router';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, RouterLink, TranslocoPipe],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.scss'
})
export class PaymentSuccessComponent implements OnInit {
  secondsLeft = 4;
  constructor(private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.authService.clearUser();
    const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
    setTimeout(() => {
      clearInterval(interval);
      this.router.navigate(['/login']);
    }, 3700);
  }
}
