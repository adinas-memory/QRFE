import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { MenuService } from './menu.service';

describe('MenuService', () => {
  let service: MenuService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    httpSpy.get.and.returnValue(of({ menu: { menuItems: [] }, categories: [], waiterCallCount: 0 }));
    TestBed.configureTestingModule({
      providers: [
        MenuService,
        { provide: HttpClient, useValue: httpSpy }
      ]
    });
    service = TestBed.inject(MenuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('passes locale query param when loading public menu', () => {
    service.getAll('restaurant-1', 'table-1', 'en').subscribe();
    expect(httpSpy.get).toHaveBeenCalledWith(
      jasmine.stringContaining('/api/public/restaurant-1/menu/table-1'),
      jasmine.objectContaining({
        withCredentials: true,
        params: jasmine.objectContaining({
          updates: jasmine.any(Object),
        }),
      }),
    );
  });
});
