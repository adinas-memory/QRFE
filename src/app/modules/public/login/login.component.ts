import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { NgStyle } from '@angular/common';
import { IconDirective } from '@coreui/icons-angular';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ButtonDirective,
  CardBodyComponent,
  CardComponent,
  CardGroupComponent,
  ColComponent,
  ContainerComponent,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  RowComponent
} from '@coreui/angular';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { UserContextModel } from '../../../core/models/userContextModel';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  imports: [RouterLink, ContainerComponent, RowComponent, ColComponent,
    CardGroupComponent, CardComponent, CardBodyComponent, FormDirective,
    InputGroupComponent, InputGroupTextDirective, IconDirective,
    FormControlDirective, ButtonDirective, NgStyle, ReactiveFormsModule]
})
export class LoginComponent implements OnInit, OnDestroy {

  loginForm: FormGroup;

  constructor(private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }


  onSubmit() {
    if (this.loginForm.valid) {
      const formValue = this.loginForm.value;


      this.authService.loginUser(formValue).subscribe({
        next: (response: UserContextModel) => {
          this.authService.setUser(response)
          const returnUrl = this.route.snapshot.queryParams['returnUrl'];
          const pending = this.subscriptionService.getPendingPlan();
          const userRole = response.role

          if (userRole === 'default') {
            this.router.navigate(['/']);
          } else if (userRole === 'default' && pending) {
            this.router.navigate(['/restaurant-setup'])
          } else if (returnUrl) {
            this.router.navigateByUrl(returnUrl);
          } else if (!pending && userRole === 'staff') {
            this.router.navigate(['/staff']);
          } else if (!pending && (userRole === 'manager')) {
            this.router.navigate(['/manager']);
          } else if (!pending && (userRole === 'gadmin')) {
            this.router.navigate(['/gadmin']);
          }

        },
        error: (error) => {
          console.error('Login failed:', error);
        }
      });

    }
  }

  ngOnInit(): void {
    // this.authService.getUserContext().subscribe(user => {
    //   if (!user) {
    //     this.router.navigate(['/register']);
    //   }
    // });
  }

  ngOnDestroy(): void {
    // lean up subscriptions or resources if needed
  }

}
