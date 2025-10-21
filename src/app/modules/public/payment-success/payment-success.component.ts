import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/auth/auth.service';

@Component({
  selector: 'app-payment-success',
  imports: [],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.scss'
})
export class PaymentSuccessComponent implements OnInit {
  constructor(private router: Router,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.authService.clearUser();
    setTimeout(() => this.router.navigate(['/login']), 5000); // 2s delay
  }
}
