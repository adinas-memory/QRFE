import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil, timer, switchMap, tap, catchError, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, SpinnerComponent } from '@coreui/angular';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [ContainerComponent, CardComponent, CardBodyComponent, ButtonDirective, AlertComponent, SpinnerComponent, RouterLink, TranslocoPipe],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.scss'
})
export class PaymentSuccessComponent implements OnInit, OnDestroy {
  provisioning = true;
  secondsLeft = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly maxPolls = 15;
  private pollCount = 0;

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    timer(0, 2000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => {
        this.pollCount++;
        return this.authService.refreshUserContext().pipe(
          catchError(() => of(null)),
        );
      }),
      tap(user => {
        if (user && user.role === 'manager') {
          this.provisioning = false;
          this.secondsLeft = 3;
          const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
          setTimeout(() => {
            clearInterval(interval);
            this.authService.clearUser();
            this.router.navigate(['/login']);
          }, 3000);
          this.destroy$.next();
        } else if (this.pollCount >= this.maxPolls) {
          this.provisioning = false;
          this.secondsLeft = 3;
          const interval = setInterval(() => this.secondsLeft = Math.max(0, this.secondsLeft - 1), 1000);
          setTimeout(() => {
            clearInterval(interval);
            this.authService.clearUser();
            this.router.navigate(['/login']);
          }, 3000);
          this.destroy$.next();
        }
      }),
    ).subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
