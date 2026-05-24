import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestaurantSetupComponent } from './restaurant-setup.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('RestaurantSetupComponent', () => {
  let component: RestaurantSetupComponent;
  let fixture: ComponentFixture<RestaurantSetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestaurantSetupComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestaurantSetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
