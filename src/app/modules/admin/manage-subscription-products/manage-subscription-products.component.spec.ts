import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ManageSubscriptionProductsComponent } from './manage-subscription-products.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';
import { environment } from '../../../../environments/environment';

describe('ManageSubscriptionProductsComponent', () => {
  let component: ManageSubscriptionProductsComponent;
  let fixture: ComponentFixture<ManageSubscriptionProductsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageSubscriptionProductsComponent],
      providers: [...COMMON_TEST_PROVIDERS, provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageSubscriptionProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(`${environment.apiUrl}/api/restaurants/subscription-products`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/api/user/restaurant-limits`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/api/restaurants/currencies`).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes fiscal integration feature only for RO market forms', () => {
    expect(component.featureKeysForForm(component.addForm)).toContain('pricing.features.fiscalNetIntegration');
    component.addForm.get('market')?.setValue('IT');
    expect(component.featureKeysForForm(component.addForm)).not.toContain('pricing.features.fiscalNetIntegration');
  });
});
