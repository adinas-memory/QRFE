import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateSubscriptionProductsComponent } from './create-subscription-products.component';

describe('CreateSubscriptionProductsComponent', () => {
  let component: CreateSubscriptionProductsComponent;
  let fixture: ComponentFixture<CreateSubscriptionProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateSubscriptionProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateSubscriptionProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
