import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentFailureComponent } from './payment-failure.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('PaymentFailureComponent', () => {
  let component: PaymentFailureComponent;
  let fixture: ComponentFixture<PaymentFailureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentFailureComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentFailureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
