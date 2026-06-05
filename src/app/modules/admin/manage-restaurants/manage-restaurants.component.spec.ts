import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ManageRestaurantsComponent } from './manage-restaurants.component';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('ManageRestaurantsComponent', () => {
  let component: ManageRestaurantsComponent;
  let fixture: ComponentFixture<ManageRestaurantsComponent>;
  let globalAdminSpy: jasmine.SpyObj<GlobalAdminService>;

  beforeEach(async () => {
    globalAdminSpy = jasmine.createSpyObj('GlobalAdminService', [
      'listRestaurants',
      'getRestaurant',
      'createRestaurant',
      'updateRestaurant',
      'deleteRestaurant'
    ]);
    globalAdminSpy.listRestaurants.and.returnValue(of({
      result: [{
        restaurantId: '11111111-1111-1111-1111-111111111111',
        restaurantName: 'Cafe-test',
        numberOfTables: 3,
        numberOfBars: 0,
        restaurantType: 'Small'
      }],
      totalCount: 1
    }));

    const miscSpy = jasmine.createSpyObj('MiscellaneousService', ['getRestaurantLimits', 'getCurrencies']);
    miscSpy.getRestaurantLimits.and.returnValue(of([]));
    miscSpy.getCurrencies.and.returnValue(of(['RON', 'EUR']));

    await TestBed.configureTestingModule({
      imports: [ManageRestaurantsComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: GlobalAdminService, useValue: globalAdminSpy },
        { provide: MiscellaneousService, useValue: miscSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManageRestaurantsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loadPage populates restaurants list', () => {
    expect(globalAdminSpy.listRestaurants).toHaveBeenCalledWith(1, 10);
    expect(component.restaurants.length).toBe(1);
    expect(component.totalCount).toBe(1);
  });
});
