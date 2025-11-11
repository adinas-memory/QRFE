import { TestBed } from '@angular/core/testing';

import { MenuResolverService } from './menu-resolver.service';

describe('MenuResolverService', () => {
  let service: MenuResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MenuResolverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
