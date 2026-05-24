import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AppToastService } from './toast-service.service';
import { first } from 'rxjs/operators';

describe('AppToastService', () => {
  let service: AppToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppToastService]
    });
    service = TestBed.inject(AppToastService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should push success toast with correct structure', () => {
    service.success('Operation completed successfully', 'Cool Title', 2000);
    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Operation completed successfully');
      expect(toasts[0].title).toBe('Cool Title');
      expect(toasts[0].color).toBe('success');
      expect(toasts[0].autohide).toBe(true);
      expect(toasts[0].delay).toBe(2000);
      expect(toasts[0].id).toBeDefined();
    });
  });

  it('should push error toast with default title and delay', () => {
    service.error('Failed to save data');
    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Failed to save data');
      expect(toasts[0].title).toBe('Error');
      expect(toasts[0].color).toBe('danger');
      expect(toasts[0].autohide).toBe(true);
      expect(toasts[0].delay).toBe(5000);
    });
  });

  it('should push info toast', () => {
    service.info('Update available');
    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].color).toBe('info');
    });
  });

  it('should push sticky toast without autohide', () => {
    service.sticky('Warning: high memory usage', 'System Warning', 'warning');
    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts[0].message).toBe('Warning: high memory usage');
      expect(toasts[0].title).toBe('System Warning');
      expect(toasts[0].color).toBe('warning');
      expect(toasts[0].autohide).toBe(false);
    });
  });

  it('should remove a toast by id', () => {
    service.info('Toast 1');
    service.info('Toast 2');
    
    let toastIdToRemove = '';
    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(2);
      toastIdToRemove = toasts[0].id;
    });

    service.remove(toastIdToRemove);

    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(1);
      expect(toasts.find(t => t.id === toastIdToRemove)).toBeUndefined();
    });
  });

  it('should clear all toasts', () => {
    service.info('Toast 1');
    service.info('Toast 2');
    service.clear();

    service.toasts$.pipe(first()).subscribe(toasts => {
      expect(toasts.length).toBe(0);
    });
  });

  it('should autohide toast after delay', fakeAsync(() => {
    service.success('Success message', 'Title', 3000);
    
    let currentToastsLength = 0;
    const sub = service.toasts$.subscribe(toasts => {
      currentToastsLength = toasts.length;
    });

    expect(currentToastsLength).toBe(1);

    tick(1500); // Only half the time passed
    expect(currentToastsLength).toBe(1);

    tick(1500); // Total 3000ms passed
    expect(currentToastsLength).toBe(0);
    sub.unsubscribe();
  }));
});
