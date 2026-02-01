import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageSubscriptionProductsComponent } from './manage-subscription-products.component';

describe('ManageSubscriptionProductsComponent', () => {
  let component: ManageSubscriptionProductsComponent;
  let fixture: ComponentFixture<ManageSubscriptionProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageSubscriptionProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageSubscriptionProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
