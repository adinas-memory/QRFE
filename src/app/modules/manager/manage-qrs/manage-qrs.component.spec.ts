import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageQrsComponent } from './manage-qrs.component';

describe('ManageQrsComponent', () => {
  let component: ManageQrsComponent;
  let fixture: ComponentFixture<ManageQrsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageQrsComponent]
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
