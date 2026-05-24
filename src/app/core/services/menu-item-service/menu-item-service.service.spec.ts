import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { OfflineDbService } from '../../offline/offline-db';
import { MenuItemServiceService } from './menu-item-service.service';

describe('MenuItemServiceService', () => {
  let service: MenuItemServiceService;

  beforeEach(() => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put', 'delete', 'patch']);
    const offlineSpy = jasmine.createSpyObj('OfflineDbService', ['cacheMenu', 'loadMenu']);

    TestBed.configureTestingModule({
      providers: [
        MenuItemServiceService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: OfflineDbService, useValue: offlineSpy }
      ]
    });
    service = TestBed.inject(MenuItemServiceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
