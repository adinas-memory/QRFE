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

  it('should emit true while a request is in flight', () => {
    const end = service.beginRequest();
    let visible = false;
    service.loading$.pipe(first()).subscribe(loading => {
      visible = loading;
    });
    expect(visible).toBeTrue();
    end();
  });

  it('should stay true until all in-flight requests end', () => {
    const end1 = service.beginRequest();
    const end2 = service.beginRequest();

    let currentLoading = false;
    const sub = service.loading$.subscribe(loading => {
      currentLoading = loading;
    });

    expect(currentLoading).toBeTrue();

    end1();
    expect(currentLoading).toBeTrue();

    end2();
    expect(currentLoading).toBeFalse();
    sub.unsubscribe();
  });

  it('reset clears all in-flight tracking', () => {
    service.beginRequest();
    service.reset();
    let currentLoading = true;
    service.loading$.pipe(first()).subscribe(loading => {
      currentLoading = loading;
    });
    expect(currentLoading).toBeFalse();
  });
});
