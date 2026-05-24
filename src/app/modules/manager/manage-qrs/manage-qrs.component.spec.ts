import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageQrsComponent } from './manage-qrs.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('ManageQrsComponent', () => {
  let component: ManageQrsComponent;
  let fixture: ComponentFixture<ManageQrsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageQrsComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageQrsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
