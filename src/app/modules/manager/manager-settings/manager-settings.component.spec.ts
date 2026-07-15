import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ManagerSettingsComponent } from './manager-settings.component';
import { AuthService } from '../../../core/auth/auth.service';
import { MiscellaneousService } from '../../../core/services/misc/miscellaneous.service';
import { SubscriptionService } from '../../../core/services/subscription-service/subscription.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { PrintJobsService } from '../../../core/services/print-jobs/print-jobs.service';
import { OfflinePrimaryService } from '../../../core/services/offline-primary/offline-primary.service';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('ManagerSettingsComponent bill printer', () => {
  let component: ManagerSettingsComponent;
  let fixture: ComponentFixture<ManagerSettingsComponent>;
  let printJobs: jasmine.SpyObj<PrintJobsService>;
  let offlinePrimary: jasmine.SpyObj<OfflinePrimaryService>;

  beforeEach(async () => {
    printJobs = jasmine.createSpyObj('PrintJobsService', [
      'listAgentPrinters',
      'listAgentInstallations',
      'getDefaultBillPrinter',
      'updateDefaultBillPrinter',
      'getFiscalPrinterSettings',
      'updateFiscalPrinterSettings',
    ]);
    offlinePrimary = jasmine.createSpyObj('OfflinePrimaryService', [
      'listStaff',
      'getPolicy',
      'updatePolicy',
    ]);
    offlinePrimary.listStaff.and.returnValue(
      of([{ userId: 'staff-1', email: 'waiter@example.com', displayName: 'Waiter One' }]),
    );
    offlinePrimary.getPolicy.and.returnValue(
      of({
        offlinePrimaryStaffUserId: null,
        deviceBound: false,
      }),
    );
    offlinePrimary.updatePolicy.and.returnValue(
      of({
        offlinePrimaryStaffUserId: 'staff-1',
        email: 'waiter@example.com',
        deviceBound: false,
      }),
    );
    printJobs.listAgentPrinters.and.returnValue(
      of([{ id: 'main-prnt', name: 'main-prnt', ipAddress: '192.168.1.1', port: 9100 }]),
    );
    printJobs.listAgentInstallations.and.returnValue(of([]));
    printJobs.getDefaultBillPrinter.and.returnValue(of({ defaultBillPrinterId: 'main-printer' }));
    printJobs.getFiscalPrinterSettings.and.returnValue(
      of({
        fiscalPrintingEnabled: false,
        defaultFiscalPrinterId: null,
        vatGroupMapping: { '19': 1, '9': 2, '5': 3 },
      }),
    );
    printJobs.updateFiscalPrinterSettings.and.returnValue(
      of({
        fiscalPrintingEnabled: true,
        defaultFiscalPrinterId: 'fiscal-1',
        vatGroupMapping: { '19': 1 },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [ManagerSettingsComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getUserRole: () => 'manager',
            getUserRestaurantId: () => '019c1a13-db50-763a-8cde-4a39922a538d',
            getUserSnapshot: () => ({
              id: 'mgr-1',
              role: 'manager',
              restaurantId: '019c1a13-db50-763a-8cde-4a39922a538d',
            }),
          },
        },
        {
          provide: MiscellaneousService,
          useValue: {
            getCurrencies: () => of(['EUR', 'RON']),
            getFirstErrorMessage: () => 'error',
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            cancelSubscription: () => of(void 0),
            getManagerSubscriptionStatus: () =>
              of({
                subscriptionStatus: 'active',
                cancelAtPeriodEnd: false,
                cancelAtUtc: null,
              }),
          },
        },
        { provide: AppToastService, useValue: { success: (): void => {}, error: (): void => {} } },
        { provide: PrintJobsService, useValue: printJobs },
        { provide: OfflinePrimaryService, useValue: offlinePrimary },
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

  it('loads offline primary staff list on init', () => {
    expect(offlinePrimary.listStaff).toHaveBeenCalled();
    expect(offlinePrimary.getPolicy).toHaveBeenCalled();
    expect(component.offlinePrimaryStaff.length).toBe(1);
  });

  it('saveOfflinePrimaryStaff PATCHes policy', () => {
    component.selectedOfflinePrimaryStaffUserId = 'staff-1';
    component.saveOfflinePrimaryStaff();
    expect(offlinePrimary.updatePolicy).toHaveBeenCalledWith(
      '019c1a13-db50-763a-8cde-4a39922a538d',
      'staff-1',
    );
  });

  it('hides fiscal printer card when locale is not Romanian', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#fiscal-printer')).toBeNull();
  });

  it('shows fiscal printer card when locale is Romanian', async () => {
    const transloco = TestBed.inject(TranslocoService);
    await transloco.load('ro').toPromise();
    transloco.setActiveLang('ro');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#fiscal-printer')).not.toBeNull();
  });

  it('loads fiscal printer settings on init', () => {
    expect(printJobs.getFiscalPrinterSettings).toHaveBeenCalledWith('019c1a13-db50-763a-8cde-4a39922a538d');
  });
});

describe('ManagerSettingsComponent reseller context', () => {
  it('hides subscription cancel for reseller role', async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSettingsComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getUserRole: () => 'reseller',
            getUserRestaurantId: () => null,
            getUserSnapshot: () => ({ id: 'res-1', role: 'reseller' }),
          },
        },
        {
          provide: MiscellaneousService,
          useValue: { getCurrencies: () => of(['EUR']), getFirstErrorMessage: () => 'error' },
        },
        {
          provide: SubscriptionService,
          useValue: { cancelSubscription: () => of(void 0), getManagerSubscriptionStatus: () => of(null) },
        },
        { provide: AppToastService, useValue: { success: (): void => {}, error: (): void => {} } },
        {
          provide: PrintJobsService,
          useValue: {
            listAgentPrinters: () => of([]),
            listAgentInstallations: () => of([]),
            getDefaultBillPrinter: () => of({ defaultBillPrinterId: null }),
            getFiscalPrinterSettings: () =>
              of({
                fiscalPrintingEnabled: false,
                defaultFiscalPrinterId: null,
                vatGroupMapping: {},
              }),
            updateFiscalPrinterSettings: () =>
              of({
                fiscalPrintingEnabled: false,
                defaultFiscalPrinterId: null,
                vatGroupMapping: {},
              }),
          },
        },
        {
          provide: OfflinePrimaryService,
          useValue: {
            listStaff: () => of([]),
            getPolicy: () => of({ offlinePrimaryStaffUserId: null, deviceBound: false }),
            updatePolicy: () => of({ offlinePrimaryStaffUserId: null, deviceBound: false }),
          },
        },
        provideTransloco({
          config: {
            availableLangs: ['en'],
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

    const fixture = TestBed.createComponent(ManagerSettingsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.hideSubscriptionCancel).toBeTrue();
    expect(component.isManager).toBeFalse();
  });
});
