import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PartnerInquiryService } from '@app/core/services/partner-inquiry/partner-inquiry.service';
import { PartnerPortfolioSize } from '@app/core/models/partner-inquiry.model';
import { COMMON_TEST_PROVIDERS } from '@app/testing/common-test-providers';
import { PartnersLandingComponent } from './partners-landing.component';

describe('PartnersLandingComponent', () => {
  let component: PartnersLandingComponent;
  let fixture: ComponentFixture<PartnersLandingComponent>;
  let partnerInquirySpy: jasmine.SpyObj<PartnerInquiryService>;

  beforeEach(async () => {
    partnerInquirySpy = jasmine.createSpyObj<PartnerInquiryService>('PartnerInquiryService', ['submit']);
    partnerInquirySpy.submit.and.returnValue(of({ id: 'test-id' }));

    await TestBed.configureTestingModule({
      imports: [PartnersLandingComponent],
      providers: [
        ...COMMON_TEST_PROVIDERS,
        { provide: PartnerInquiryService, useValue: partnerInquirySpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartnersLandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not submit when form is invalid', () => {
    component.onSubmit();
    expect(partnerInquirySpy.submit).not.toHaveBeenCalled();
    expect(component.submitSuccess).toBeFalse();
  });

  it('submits valid form and shows success', () => {
    component.form.setValue({
      companyName: 'Rossi Sistemi SRL',
      contactEmail: 'contact@rossi.it',
      cityRegion: 'Milano / Lombardia',
      portfolioSize: PartnerPortfolioSize.OverTwoHundred,
      message: 'Interested in wholesale pricing.',
    });

    component.onSubmit();

    expect(partnerInquirySpy.submit).toHaveBeenCalled();
    expect(component.submitSuccess).toBeTrue();
    expect(component.submitError).toBeFalse();
  });

  it('shows error when submit fails', () => {
    partnerInquirySpy.submit.and.returnValue(throwError(() => new Error('network')));

    component.form.setValue({
      companyName: 'Demo SRL',
      contactEmail: 'demo@test.com',
      cityRegion: 'București',
      portfolioSize: PartnerPortfolioSize.ZeroToFifty,
      message: 'Hello',
    });

    component.onSubmit();

    expect(component.submitError).toBeTrue();
    expect(component.submitSuccess).toBeFalse();
  });
});
