import { TestBed } from '@angular/core/testing';

import { MenuItemServiceService } from './menu-item-service.service';

describe('MenuItemServiceService', () => {
  let service: MenuItemServiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MenuItemServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
