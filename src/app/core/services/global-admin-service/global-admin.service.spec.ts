import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { GlobalAdminService } from './global-admin.service';
import { environment } from '../../../../environments/environment';

describe('GlobalAdminService', () => {
  let service: GlobalAdminService;
  let httpSpy: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put', 'delete']);

    TestBed.configureTestingModule({
      providers: [
        GlobalAdminService,
        { provide: HttpClient, useValue: httpSpy }
      ]
    });
    service = TestBed.inject(GlobalAdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listRestaurants calls GET with page params and credentials', () => {
    httpSpy.get.and.returnValue(of({ result: [], totalCount: 0 }));

    service.listRestaurants(2, 10).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/api/restaurants/2/10`,
      { withCredentials: true }
    );
  });

  it('getRestaurant calls GET by id with credentials', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    httpSpy.get.and.returnValue(of({ restaurantId: id, restaurantName: 'Test', restaurantType: 'Small' }));

    service.getRestaurant(id).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/api/restaurants/${id}`,
      { withCredentials: true }
    );
  });

  it('createRestaurant POSTs payload with credentials', () => {
    const payload = { restaurantName: 'Cafe', useCurrency: 'RON', restaurantType: 'Small' };
    httpSpy.post.and.returnValue(of({ restaurantId: 'id', restaurantName: 'Cafe', restaurantType: 'Small' }));

    service.createRestaurant(payload).subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/api/restaurants`,
      payload,
      { withCredentials: true }
    );
  });

  it('updateRestaurant PUTs payload with credentials', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const payload = { restaurantName: 'Cafe', itHasBar: true };
    httpSpy.put.and.returnValue(of({ restaurantId: id, restaurantName: 'Cafe', restaurantType: 'Small' }));

    service.updateRestaurant(id, payload).subscribe();

    expect(httpSpy.put).toHaveBeenCalledWith(
      `${environment.apiUrl}/api/restaurants/${id}`,
      payload,
      { withCredentials: true }
    );
  });

  it('deleteRestaurant DELETEs by id with credentials', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    httpSpy.delete.and.returnValue(of({ restaurantId: id, success: true }));

    service.deleteRestaurant(id).subscribe();

    expect(httpSpy.delete).toHaveBeenCalledWith(
      `${environment.apiUrl}/api/restaurants/${id}`,
      { withCredentials: true }
    );
  });
});
