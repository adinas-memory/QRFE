import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageStaffComponent } from './manage-staff.component';

describe('ManageStaffComponent', () => {
  let component: ManageStaffComponent;
  let fixture: ComponentFixture<ManageStaffComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageStaffComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageStaffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
