import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { GadminDashboardComponent } from './gadmin-dashboard.component';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';

describe('GadminDashboardComponent', () => {
  let component: GadminDashboardComponent;
  let fixture: ComponentFixture<GadminDashboardComponent>;
  let globalAdminSpy: jasmine.SpyObj<GlobalAdminService>;

  beforeEach(async () => {
    globalAdminSpy = jasmine.createSpyObj('GlobalAdminService', ['listRestaurants']);
    globalAdminSpy.listRestaurants.and.returnValue(of({
      result: [{
        restaurantId: '1',
        restaurantName: 'Test-abc',
        numberOfTables: 5,
        numberOfBars: 1,
        restaurantType: 'Small'
      }],
      totalCount: 1
    }));

    await TestBed.configureTestingModule({
      imports: [GadminDashboardComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: GlobalAdminService, useValue: globalAdminSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GadminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads restaurant stats on init', () => {
    expect(globalAdminSpy.listRestaurants).toHaveBeenCalled();
    expect(component.totalCount).toBe(1);
    expect(component.restaurants.length).toBe(1);
  });

  it('computes page numbers for pagination', () => {
    component.totalCount = 45;
    component.pageSize = 10;
    component.pageNumber = 3;
    expect(component.totalPages).toBe(5);
    expect(component.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(component.showPagination).toBeTrue();
  });
});
