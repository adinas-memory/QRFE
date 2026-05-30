import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { MiscellaneousService } from '../misc/miscellaneous.service';
import { OfflineDbService } from '../../offline/offline-db';
import { OnlineStateService } from '../../offline/online-state-service';
import { PlatformStorageService } from '../../platform/platform-storage.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(() => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put', 'delete']);
    const miscSpy = jasmine.createSpyObj('MiscellaneousService', ['getTableCss', 'parseApiError', 'getFirstErrorMessage']);
    const offlineSpy = jasmine.createSpyObj('OfflineDbService', ['loadOrder', 'saveOrderSnapshot']);
    const onlineSpy = jasmine.createSpyObj('OnlineStateService', ['setOffline', 'setOnline'], { isOnline: true });
    const platformStorageSpy = jasmine.createSpyObj('PlatformStorageService', ['getString', 'setString']);
    platformStorageSpy.getString.and.returnValue(Promise.resolve(null));
    platformStorageSpy.setString.and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        OrdersService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: MiscellaneousService, useValue: miscSpy },
        { provide: OfflineDbService, useValue: offlineSpy },
        { provide: OnlineStateService, useValue: onlineSpy },
        { provide: PlatformStorageService, useValue: platformStorageSpy },
      ]
    });
    service = TestBed.inject(OrdersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
