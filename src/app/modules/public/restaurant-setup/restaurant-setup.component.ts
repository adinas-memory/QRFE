import { Component } from '@angular/core';
import { FormBuilder, FormGroup,  ReactiveFormsModule } from '@angular/forms';
import {
  ContainerComponent,
  ButtonDirective,
  ColComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective
} from '@coreui/angular';
import { RestaurantSetupFormModel } from '../../../core/models/restaurantSetupFormModel';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-restaurant-setup',
  imports: [
  ReactiveFormsModule,
  ContainerComponent,
  ButtonDirective,
  ColComponent,
  FormCheckComponent,
  FormCheckInputDirective,
  FormCheckLabelDirective,
  FormControlDirective,
  FormDirective,
  FormLabelDirective,
  FormSelectDirective],
  standalone: true,
  templateUrl: './restaurant-setup.component.html',
  styleUrl: './restaurant-setup.component.scss'
})
export class RestaurantSetupComponent {

  restaurantSetupForm: FormGroup;

  constructor(private fb: FormBuilder,
    private router: Router,
    private subscriptionService: SubscriptionService
  ) {
    this.restaurantSetupForm = this.fb.group({
      restaurantName: [''],
      address: [''],
      city: [''],
      state: [''],
      country: [''],
      zip: [''],
      registrationNumber: [''],
      sameAddressForBilling: [false],
      billingAddress: ['']
    });
  }

  onSubmit() {
  const pending = this.subscriptionService.getPendingPlan();
  if (!pending) return;

  const payload = {
    ...this.restaurantSetupForm.value,
    priceId: pending.priceId,
    restaurantType: pending.restaurantType
  };

  this.subscriptionService.subscribeToPlan(payload).subscribe({
    next: () => {
      this.subscriptionService.clearPendingPlan();
      this.router.navigate(['/dashboard']);
      }
    });
  }

}
