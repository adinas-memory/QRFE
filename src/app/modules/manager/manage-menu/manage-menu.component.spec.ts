import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageMenuComponent } from './manage-menu.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('ManageMenuComponent', () => {
  let component: ManageMenuComponent;
  let fixture: ComponentFixture<ManageMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageMenuComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
