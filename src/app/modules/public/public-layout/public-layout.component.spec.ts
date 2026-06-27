import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { PublicLayoutComponent } from './public-layout.component';
import { MenuService } from '../../../core/services/menu-public/menu.service';
import { GuestMenuViewService } from '../../../core/services/menu-public/guest-menu-view.service';
import { AppToastService } from '../../../core/services/toast-service/toast-service.service';

describe('PublicLayoutComponent', () => {
  let component: PublicLayoutComponent;
  let fixture: ComponentFixture<PublicLayoutComponent>;
  let menuService: jasmine.SpyObj<MenuService>;
  let guestMenuView: jasmine.SpyObj<GuestMenuViewService>;

  beforeEach(async () => {
    menuService = jasmine.createSpyObj<MenuService>('MenuService', [
      'getTableOrder',
      'getEcoBonUrl',
      'downloadEcoBon',
      'callWaiter',
      'listenPublicRestaurantSse',
    ]);
    guestMenuView = jasmine.createSpyObj<GuestMenuViewService>('GuestMenuViewService', ['reloadMenu']);
    Object.defineProperty(guestMenuView, 'menuState$', { value: of(null) });
    Object.defineProperty(guestMenuView, 'showingSetMenuView', { value: false });
    Object.defineProperty(guestMenuView, 'todaySetMenu', { value: null });
    guestMenuView.reloadMenu.and.returnValue(of({
      menu: { menuId: 'm1', menuItems: [] },
      categories: [],
      waiterCallCount: 0,
    }));
    menuService.getTableOrder.and.returnValue(of(null));
    menuService.getEcoBonUrl.and.returnValue('http://localhost/api/public/r1/tables/t1/eco-bon');
    menuService.listenPublicRestaurantSse.and.returnValue(of());

    await TestBed.configureTestingModule({
      imports: [PublicLayoutComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideTransloco({
          config: {
            availableLangs: ['en', 'ro'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
        }),
        { provide: MenuService, useValue: menuService },
        { provide: GuestMenuViewService, useValue: guestMenuView },
        { provide: AppToastService, useValue: jasmine.createSpyObj('AppToastService', ['success', 'error']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('builds eco bon url from restaurant and table ids', () => {
    component.restaurantId = 'r1';
    component.tableId = 't1';
    expect(component.ecoBonUrl).toContain('/eco-bon');
    expect(menuService.getEcoBonUrl).toHaveBeenCalledWith('r1', 't1');
  });

  it('refetches menu when language changes', () => {
    component.restaurantId = 'r1';
    component.tableId = 't1';
    component.setLanguage('en');
    expect(guestMenuView.reloadMenu).toHaveBeenCalledWith('en');
  });
});
