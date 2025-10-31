import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastSampleIconComponent } from './toast-sample-icon.component';

describe('ToastSampleIconComponent', () => {
  let component: ToastSampleIconComponent;
  let fixture: ComponentFixture<ToastSampleIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastSampleIconComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToastSampleIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
