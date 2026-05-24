import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { OnlineStateService } from '../../offline/online-state-service';
import { OfflineDbService } from '../../offline/offline-db';
import { TablesService } from './tables.service';

describe('TablesService', () => {
  let service: TablesService;

  beforeEach(() => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put', 'delete']);
    const onlineSpy = jasmine.createSpyObj('OnlineStateService', ['setOffline', 'setOnline'], { isOnline: true });
    const offlineSpy = jasmine.createSpyObj('OfflineDbService', ['saveTables', 'saveTablesStatus', 'loadLocalTables']);

    TestBed.configureTestingModule({
      providers: [
        TablesService,
        { provide: HttpClient, useValue: httpSpy },
        { provide: OnlineStateService, useValue: onlineSpy },
        { provide: OfflineDbService, useValue: offlineSpy }
      ]
    });
    service = TestBed.inject(TablesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
