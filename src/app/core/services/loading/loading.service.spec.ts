import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.service';
import { first } from 'rxjs/operators';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoadingService]
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

  it('should remain true when show is called multiple times and hide is called fewer times', () => {
    service.show(); // counter = 1
    service.show(); // counter = 2
    
    let currentLoading = false;
    const sub = service.loading$.subscribe(loading => {
      currentLoading = loading;
    });

    expect(currentLoading).toBeTrue();

    service.hide(); // counter = 1
    expect(currentLoading).toBeTrue();

    service.hide(); // counter = 0
    expect(currentLoading).toBeFalse();
    sub.unsubscribe();
  });

  it('should handle hide calls when already at zero loading and reset to zero', () => {
    let currentLoading = true;
    const sub = service.loading$.subscribe(loading => {
      currentLoading = loading;
    });

    expect(currentLoading).toBeFalse();

    service.hide(); // should remain at zero and false
    expect(currentLoading).toBeFalse();

    // Call show once, it should go to 1 (true)
    service.show();
    expect(currentLoading).toBeTrue();

    // Call hide once, it should go back to 0 (false)
    service.hide();
    expect(currentLoading).toBeFalse();
    sub.unsubscribe();
  });
});
