import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
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

  afterEach(() => {
    service.clearPublicPage();
    document.querySelectorAll('link[rel="canonical"]').forEach(el => el.remove());
    document.querySelectorAll('script[type="application/ld+json"]').forEach(el => el.remove());
  });

  it('sets title and meta tags for landing', () => {
    service.applyPublicPage('landing');
    expect(titleSpy.setTitle).toHaveBeenCalledWith('seo.landingTitle');
    expect(metaSpy.addTag).toHaveBeenCalled();
    expect(document.documentElement.lang).toBe('en');
  });

  it('adds canonical link and og:url for public pages', () => {
    service.applyPublicPage('partners');

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    expect(canonical?.href).toBe(`${environment.publicSiteUrl}/partners`);
  });

  it('adds canonical link and og:url for faq', () => {
    service.applyPublicPage('faq');

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    expect(canonical?.href).toBe(`${environment.publicSiteUrl}/faq`);

    expect(metaSpy.addTag).toHaveBeenCalledWith(
      jasmine.objectContaining({ property: 'og:url', content: `${environment.publicSiteUrl}/faq` }),
    );
  });

  it('injects Organization JSON-LD structured data', () => {
    service.applyPublicPage('landing');

    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain('"@type":"Organization"');
    expect(script?.textContent).toContain('Universal Restaurant Systems');
  });

  it('removes canonical and JSON-LD on clear', () => {
    service.applyPublicPage('contact');
    expect(document.querySelector('link[rel="canonical"]')).not.toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();

    service.clearPublicPage();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
