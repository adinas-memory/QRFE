import { TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';

import { MenuResolver } from './menu-resolver.service';
import { MenuService } from './menu.service';
import { GuestMenuViewService } from './guest-menu-view.service';

describe('MenuResolver', () => {
  let resolver: MenuResolver;
  let menuServiceMock: jasmine.SpyObj<MenuService>;
  let guestMenuViewServiceMock: jasmine.SpyObj<GuestMenuViewService>;

  beforeEach(() => {
    const menuSpy = jasmine.createSpyObj('MenuService', ['getAll']);
    const guestSpy = jasmine.createSpyObj('GuestMenuViewService', ['initFromResponse']);

    TestBed.configureTestingModule({
      providers: [
        MenuResolver,
        { provide: MenuService, useValue: menuSpy },
        { provide: GuestMenuViewService, useValue: guestSpy },
        provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            prodMode: true,
          },
        }),
      ]
    });
    resolver = TestBed.inject(MenuResolver);
    menuServiceMock = TestBed.inject(MenuService) as jasmine.SpyObj<MenuService>;
    guestMenuViewServiceMock = TestBed.inject(GuestMenuViewService) as jasmine.SpyObj<GuestMenuViewService>;
  });

  it('should be created', () => {
    expect(resolver).toBeTruthy();
  });
});
