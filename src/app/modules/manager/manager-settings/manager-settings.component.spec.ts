import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ManagerSettingsComponent } from './manager-settings.component';
import { AuthService } from '../../../core/auth/auth.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { PrintJobsService } from '../../../core/services/print-jobs/print-jobs.service';
import { provideTransloco } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ManagerSettingsComponent bill printer', () => {
  let component: ManagerSettingsComponent;
  let fixture: ComponentFixture<ManagerSettingsComponent>;
  let printJobs: jasmine.SpyObj<PrintJobsService>;

  beforeEach(async () => {
    printJobs = jasmine.createSpyObj('PrintJobsService', [
      'listAgentPrinters',
      'listAgentInstallations',
      'getDefaultBillPrinter',
      'updateDefaultBillPrinter',
    ]);
    printJobs.listAgentPrinters.and.returnValue(
      of([{ id: 'main-prnt', name: 'main-prnt', ipAddress: '192.168.1.1', port: 9100 }]),
    );
    printJobs.listAgentInstallations.and.returnValue(of([]));
    printJobs.getDefaultBillPrinter.and.returnValue(of({ defaultBillPrinterId: 'main-printer' }));

    await TestBed.configureTestingModule({
      imports: [ManagerSettingsComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getUserRole: () => 'manager',
            getUserRestaurantId: () => '019c1a13-db50-763a-8cde-4a39922a538d',
          },
        },
        {
          provide: MiscellaneousService,
          useValue: {
            getCurrencies: () => of(['EUR', 'RON']),
            getFirstErrorMessage: () => 'error',
          },
        },
        { provide: SubscriptionService, useValue: { cancelSubscription: () => of(void 0) } },
        { provide: AppToastService, useValue: { success: (): void => {}, error: (): void => {} } },
        { provide: PrintJobsService, useValue: printJobs },
        provideTransloco({
          config: {
            availableLangs: ['en', 'ro'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
        }),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagerSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('detects default printer id mismatch with agent list', () => {
    component.billPrinters = [{ id: 'main-prnt', name: 'main-prnt', ipAddress: '192.168.1.1', port: 9100 }];
    component.defaultBillPrinterId = 'main-printer';
    expect(component.isDefaultBillPrinterMismatch).toBeTrue();
  });

  it('auto-selects the sole agent printer when default is mismatched', () => {
    expect(component.defaultBillPrinterId).toBe('main-prnt');
    expect(component.isDefaultBillPrinterMismatch).toBeFalse();
  });

  it('includes synthetic pending option for mismatched saved id', () => {
    component.defaultBillPrinterId = 'main-printer';
    const ids = component.billPrinterOptions.map(p => p.id);
    expect(ids).toContain('main-printer');
    expect(ids).toContain('main-prnt');
  });
});
