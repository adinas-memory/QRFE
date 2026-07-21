import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageStaffComponent } from './manage-staff.component';
import { AuthService } from '../../../core/auth/auth.service';
import { StaffAdminService } from '../../../core/services/staff-admin-service/staff-admin.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { provideTransloco } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

describe('ManageStaffComponent', () => {
  let component: ManageStaffComponent;
  let fixture: ComponentFixture<ManageStaffComponent>;
  let staffAdmin: jasmine.SpyObj<StaffAdminService>;

  beforeEach(async () => {
    staffAdmin = jasmine.createSpyObj<StaffAdminService>('StaffAdminService', [
      'registerStaff',
      'listStaff',
      'disableStaff',
      'enableStaff'
    ]);
    staffAdmin.listStaff.and.returnValue(
      of([
        {
          userId: 'staff-1',
          email: 'waiter@example.com',
          displayName: 'Waiter One',
          role: 'staff'
        },
        {
          userId: 'staff-2',
          email: 'disabled@example.com',
          displayName: 'Disabled User',
          role: 'soft_deleted_staff_user'
        }
      ])
    );
    staffAdmin.registerStaff.and.returnValue(of({ isSuccess: true }));
    staffAdmin.disableStaff.and.returnValue(of(true));
    staffAdmin.enableStaff.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [ManageStaffComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getUserContext: () =>
              of({ id: '1', role: 'manager', restaurantId: '00000000-0000-0000-0000-000000000001' })
          }
        },
        { provide: StaffAdminService, useValue: staffAdmin },
        { provide: AppToastService, useValue: { success: (): void => {}, error: (): void => {} } },
        provideTransloco({
          config: {
            availableLangs: ['en', 'ro'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true
          }
        }),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations()
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageStaffComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads staff list on init', () => {
    expect(staffAdmin.listStaff).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    expect(component.staffList.length).toBe(2);
  });

  it('disables active staff access', () => {
    component.onDisableStaff(component.staffList[0]);
    expect(staffAdmin.disableStaff).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'staff-1'
    );
  });

  it('re-enables disabled staff access', () => {
    component.onEnableStaff(component.staffList[1]);
    expect(staffAdmin.enableStaff).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'staff-2'
    );
  });
});
