import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { TranslocoService } from '@jsverse/transloco';
import { of, Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;
  let titleSpy: jasmine.SpyObj<Title>;
  let metaSpy: jasmine.SpyObj<Meta>;
  let langChanges$: Subject<string>;
  let translocoSpy: jasmine.SpyObj<TranslocoService>;

  beforeEach(() => {
    langChanges$ = new Subject<string>();
    titleSpy = jasmine.createSpyObj<Title>('Title', ['setTitle']);
    metaSpy = jasmine.createSpyObj<Meta>('Meta', ['getTag', 'updateTag', 'addTag', 'removeTag']);
    metaSpy.getTag.and.returnValue(null);

    translocoSpy = jasmine.createSpyObj<TranslocoService>('TranslocoService', ['translate', 'getActiveLang', 'load']);
    translocoSpy.translate.and.callFake((key: string) => {
      const translations: Record<string, string> = {
        'seo.landingTitle': 'U.R.S. Landing',
        'seo.landingDescription': 'Landing description',
        'seo.keywords': 'pos, restaurant',
      };
      return (translations[key] ?? key) as never;
    });
    translocoSpy.getActiveLang.and.returnValue('en');
    translocoSpy.load.and.returnValue(of({}));
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
    document.querySelectorAll('script[data-faq-jsonld="true"]').forEach(el => el.remove());
  });

  it('sets title and meta tags for landing after translations load', () => {
    service.applyPublicPage('landing');
    expect(titleSpy.setTitle).toHaveBeenCalledWith('U.R.S. Landing');
    expect(metaSpy.addTag).toHaveBeenCalled();
    expect(document.documentElement.lang).toBe('en');
  });

  it('adds og:image and twitter card tags', () => {
    service.applyPublicPage('landing');

    expect(metaSpy.addTag).toHaveBeenCalledWith(
      jasmine.objectContaining({
        property: 'og:image',
        content: `${environment.publicSiteUrl}/public/icons/icon-512x512.png`,
      }),
    );
    expect(metaSpy.addTag).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'twitter:card', content: 'summary_large_image' }),
    );
  });

  it('re-applies SEO after language change once translations load', () => {
    service.applyPublicPage('landing');
    titleSpy.setTitle.calls.reset();

    translocoSpy.getActiveLang.and.returnValue('it');
    langChanges$.next('it');

    expect(translocoSpy.load).toHaveBeenCalledWith('it');
    expect(titleSpy.setTitle).toHaveBeenCalledWith('U.R.S. Landing');
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

  it('sets noindex on applyNoIndex', () => {
    service.applyNoIndex();

    expect(metaSpy.addTag).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'robots', content: 'noindex, nofollow' }),
    );
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
