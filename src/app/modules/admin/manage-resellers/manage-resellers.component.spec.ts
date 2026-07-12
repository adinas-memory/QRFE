import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManageResellersComponent } from './manage-resellers.component';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { provideTransloco } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

describe('ManageResellersComponent', () => {
  let component: ManageResellersComponent;
  let fixture: ComponentFixture<ManageResellersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageResellersComponent],
      providers: [
        {
          provide: GlobalAdminService,
          useValue: {
            createReseller: () =>
              of({ isSuccess: true, userId: '00000000-0000-0000-0000-000000000001', email: 'r@example.com' }),
            listResellers: () => of({ result: [], totalCount: 0 })
          }
        },
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
    }).compileComponents();

    fixture = TestBed.createComponent(ManageResellersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('submits valid form', () => {
    component.resellerForm.setValue({
      name: 'Pat',
      surname: 'Partner',
      email: 'partner@example.com',
      phone: '+40123456789',
      password: 'Secret1!@',
      confirmPassword: 'Secret1!@'
    });
    component.onSubmit();
    expect(component.submitting).toBeFalse();
  });
});
