import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagePrinterFleetComponent } from './manage-printer-fleet.component';
import { COMMON_TEST_PROVIDERS } from '../../../testing/common-test-providers';
import { GlobalAdminService } from '../../../core/services/global-admin-service/global-admin.service';
import { of } from 'rxjs';

describe('ManagePrinterFleetComponent', () => {
  let component: ManagePrinterFleetComponent;
  let fixture: ComponentFixture<ManagePrinterFleetComponent>;

  beforeEach(async () => {
    const globalAdminSpy = jasmine.createSpyObj<GlobalAdminService>('GlobalAdminService', ['listPrinterFleet']);
    globalAdminSpy.listPrinterFleet.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ManagePrinterFleetComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: GlobalAdminService, useValue: globalAdminSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManagePrinterFleetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
