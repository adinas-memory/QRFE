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

  beforeEach(async () => {
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
        { provide: StaffAdminService, useValue: { registerStaff: () => of({ isSuccess: true }) } },
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
});
