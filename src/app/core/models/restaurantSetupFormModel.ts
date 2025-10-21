export interface RestaurantSetupFormModel {
  priceId: string;
  restaurantName: string;
  address: string;
  city: string;
  country: string;
  zip: string;
  registrationNumber: string;
  sameAddressForBilling: boolean;
  billingAddress: string;
}
