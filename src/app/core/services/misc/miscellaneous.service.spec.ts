import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { MiscellaneousService } from './miscellaneous.service';

describe('MiscellaneousService', () => {
  let service: MiscellaneousService;

  beforeEach(() => {
    const httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [
        MiscellaneousService,
        { provide: HttpClient, useValue: httpSpy }
      ]
    });
    service = TestBed.inject(MiscellaneousService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
