import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastBaseComponent } from './toast-base.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('ToastBaseComponent', () => {
  let component: ToastBaseComponent;
  let fixture: ComponentFixture<ToastBaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastBaseComponent],
      providers: [...COMMON_TEST_PROVIDERS],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ToastBaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
