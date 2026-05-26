import { TestBed } from '@angular/core/testing';
import { RuntimePlatformService } from './runtime-platform.service';

describe('RuntimePlatformService', () => {
  afterEach(() => {
    delete (window as Window & { Capacitor?: unknown }).Capacitor;
  });

  it('detects browser by default', () => {
    const service = TestBed.inject(RuntimePlatformService);
    expect(service.capabilities.surface).toBe('browser');
    expect(service.isNative).toBeFalse();
    expect(service.capabilities.hapticsBackend).toBe('vibrate');
  });

  it('detects Capacitor native and disables api align', () => {
    (window as Window & { Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string } })
      .Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const service = TestBed.inject(RuntimePlatformService);

    expect(service.capabilities.surface).toBe('capacitor-android');
    expect(service.isNative).toBeTrue();
    expect(service.shouldAlignApiUrlToPageHost).toBeFalse();
    expect(service.capabilities.hapticsBackend).toBe('capacitor-haptics');
  });
});
