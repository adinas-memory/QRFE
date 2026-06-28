import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let titleSpy: jasmine.SpyObj<Title>;
  let metaSpy: jasmine.SpyObj<Meta>;
  let langChanges$: Subject<string>;

  beforeEach(() => {
    langChanges$ = new Subject<string>();
    titleSpy = jasmine.createSpyObj<Title>('Title', ['setTitle']);
    metaSpy = jasmine.createSpyObj<Meta>('Meta', ['getTag', 'updateTag', 'addTag']);
    metaSpy.getTag.and.returnValue(null);

    const translocoSpy = jasmine.createSpyObj<TranslocoService>('TranslocoService', ['translate', 'getActiveLang']);
    translocoSpy.translate.and.callFake((key: string) => key as never);
    translocoSpy.getActiveLang.and.returnValue('en');
    Object.defineProperty(translocoSpy, 'langChanges$', { value: langChanges$.asObservable() });

    TestBed.configureTestingModule({
      providers: [
        SeoService,
        { provide: Title, useValue: titleSpy },
        { provide: Meta, useValue: metaSpy },
        { provide: TranslocoService, useValue: translocoSpy },
      ],
    });

    service = TestBed.inject(SeoService);
  });

  it('sets title and meta tags for landing', () => {
    service.applyPublicPage('landing');
    expect(titleSpy.setTitle).toHaveBeenCalledWith('seo.landingTitle');
    expect(metaSpy.addTag).toHaveBeenCalled();
    expect(document.documentElement.lang).toBe('en');
  });
});
