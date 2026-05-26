import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';
import { first } from 'rxjs/operators';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoadingService],
    });
    service = TestBed.inject(LoadingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initially emit false for loading$', () => {
    service.loading$.pipe(first()).subscribe(loading => {
      expect(loading).toBeFalse();
    });
  });

  it('should emit true when show is called', () => {
    service.show();
    service.loading$.pipe(first()).subscribe(loading => {
      expect(loading).toBeTrue();
    });
  });

  it('should remain true until all shows are hidden', () => {
    service.show();
    service.show();

    let currentLoading = false;
    const sub = service.loading$.subscribe(loading => {
      currentLoading = loading;
    });

    expect(currentLoading).toBeTrue();
    service.hide();
    expect(currentLoading).toBeTrue();
    service.hide();
    expect(currentLoading).toBeFalse();
    sub.unsubscribe();
  });
});
