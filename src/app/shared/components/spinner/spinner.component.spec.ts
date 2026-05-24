import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';
import { LoadingService } from '../../../core/services/loading/loading.service';
import { BehaviorSubject } from 'rxjs';

describe('SpinnerComponent', () => {
  let component: SpinnerComponent;
  let fixture: ComponentFixture<SpinnerComponent>;
  let loadingServiceMock: { loading$: BehaviorSubject<boolean> };

  beforeEach(async () => {
    loadingServiceMock = {
      loading$: new BehaviorSubject<boolean>(false)
    };

    await TestBed.configureTestingModule({
      imports: [SpinnerComponent],
      providers: [
        { provide: LoadingService, useValue: loadingServiceMock }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SpinnerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should NOT render overlay-spinner when loading$ is false', () => {
    loadingServiceMock.loading$.next(false);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.overlay-spinner');
    expect(overlay).toBeNull();
  });

  it('should render overlay-spinner when loading$ is true', () => {
    loadingServiceMock.loading$.next(true);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('.overlay-spinner');
    expect(overlay).not.toBeNull();
    const statusText = fixture.nativeElement.querySelector('[role="status"]');
    expect(statusText).not.toBeNull();
  });
});
