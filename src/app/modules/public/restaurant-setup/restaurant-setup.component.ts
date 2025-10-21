import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
import { SubscriptionPayloadModel } from 'src/app/core/models/subscriptionPayloadModel';

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
export class RestaurantSetupComponent implements OnInit {

  restaurantSetupForm: FormGroup<{
    restaurantName: FormControl<string>;
    address: FormControl<string>;
    city: FormControl<string>;
    country: FormControl<string>;
    zip: FormControl<string>;
    registrationNumber: FormControl<string>;
    checkAddress: FormControl<boolean>;
    billingAddress: FormControl<string>;
  }>

  constructor(private fb: FormBuilder,
    private router: Router,
    private subscriptionService: SubscriptionService
  ) {
    this.restaurantSetupForm = this.fb.group({
      restaurantName: this.fb.control('', { nonNullable: true }),
      address: this.fb.control('', { nonNullable: true }),
      city: this.fb.control('', { nonNullable: true }),
      country: this.fb.control('', { nonNullable: true }),
      zip: this.fb.control('', { nonNullable: true }),
      registrationNumber: this.fb.control('', { nonNullable: true }),
      checkAddress: this.fb.control(false, { nonNullable: true }),
      billingAddress: this.fb.control('', { nonNullable: true })
    });
  }

  onSubmit() {
    const pending = this.subscriptionService.getPendingPlan();
    if (!pending) return;

    const formValue = this.restaurantSetupForm.getRawValue(); // includes disabled fields

    const payload: SubscriptionPayloadModel = {
      priceId: pending.priceId,
      restaurantType: pending.restaurantType,
      restaurantName: formValue.restaurantName,
      address: formValue.address,
      city: formValue.city,
      country: formValue.country,
      zip: formValue.zip,
      registrationNumber: formValue?.registrationNumber ?? '',
      sameAddressForBilling: formValue?.checkAddress,
      billingAddress: formValue?.checkAddress ? formValue.address : formValue.billingAddress
    };

    this.subscriptionService.subscribeToPlan(payload).subscribe({
      next: (response: { checkoutUrl: string }) => {
        this.subscriptionService.clearPendingPlan();

        // Redirect the browser to Stripe Checkout
        window.location.href = response.checkoutUrl;
      },
      error: err => console.error('Subscription failed', err)
      // next: () => {
      //   this.subscriptionService.clearPendingPlan();
      //   this.router.navigate(['/dashboard']);
      // }
    });
  }

  ngOnInit(): void {
    this.restaurantSetupForm.get('checkAddress')?.valueChanges.subscribe(checked => {
      if (checked) {
        const address = this.restaurantSetupForm.get('address')!.value as string;
        this.restaurantSetupForm.get('billingAddress')?.setValue(address);
        this.restaurantSetupForm.get('billingAddress')?.disable(); // optional: lock field
      } else {
        this.restaurantSetupForm.get('billingAddress')?.enable(); // allow manual entry
      }
    });
  }

}
