import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResellerDashboardComponent } from './reseller-dashboard.component';
import { ResellerService } from '../../../core/services/reseller-service/reseller.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';
import { provideTransloco } from '@jsverse/transloco';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

describe('ResellerDashboardComponent', () => {
  let component: ResellerDashboardComponent;
  let fixture: ComponentFixture<ResellerDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResellerDashboardComponent],
      providers: [
        {
          provide: ResellerService,
          useValue: {
            listRestaurants: () => of({ result: [], totalCount: 0 })
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

    fixture = TestBed.createComponent(ResellerDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load scoped list', () => {
    expect(component).toBeTruthy();
    expect(component.restaurants).toEqual([]);
    expect(component.totalCount).toBe(0);
  });
});
