import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageBarsComponent } from './manage-bars.component';

describe('ManageBarsComponent', () => {
  let component: ManageBarsComponent;
  let fixture: ComponentFixture<ManageBarsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageBarsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageBarsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
