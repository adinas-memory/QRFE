import { Injectable } from '@angular/core';

export type RuntimeSurface =
  | 'browser'
  | 'pwa-standalone'
  | 'capacitor-android'
  | 'capacitor-ios'
  | 'capacitor-native';

export interface PlatformCapabilities {
  surface: RuntimeSurface;
  isNative: boolean;
  shouldAlignApiUrlToPageHost: boolean;
  serviceWorkerExpected: boolean;
  hapticsBackend: 'vibrate' | 'capacitor-haptics' | 'none';
  clientInstanceStorage: 'localStorage' | 'preferences';
}

/** Detects browser vs PWA vs Capacitor and drives apiUrl / SW / storage / haptics rules. */
@Injectable({ providedIn: 'root' })
export class RuntimePlatformService {
  private readonly caps = this.detect();

  get capabilities(): PlatformCapabilities {
    return this.caps;
  }

  get isNative(): boolean {
    return this.caps.isNative;
  }

  get shouldAlignApiUrlToPageHost(): boolean {
    return this.caps.shouldAlignApiUrlToPageHost;
  }

  get serviceWorkerExpected(): boolean {
    return this.caps.serviceWorkerExpected;
  }

  private detect(): PlatformCapabilities {
    if (typeof window === 'undefined') {
      return this.browserCaps();
    }

    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
      .Capacitor;
    const isNative = cap?.isNativePlatform?.() === true;
    const protocol = window.location.protocol;
    const isCapacitorProtocol = protocol === 'capacitor:' || protocol === 'ionic:';

    if (isNative || isCapacitorProtocol) {
      const platform = cap?.getPlatform?.() ?? 'native';
      const surface: RuntimeSurface =
        platform === 'android'
          ? 'capacitor-android'
          : platform === 'ios'
            ? 'capacitor-ios'
            : 'capacitor-native';
      return {
        surface,
        isNative: true,
        shouldAlignApiUrlToPageHost: false,
        serviceWorkerExpected: false,
        hapticsBackend: 'capacitor-haptics',
        clientInstanceStorage: 'preferences',
      };
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      return {
        surface: 'pwa-standalone',
        isNative: false,
        shouldAlignApiUrlToPageHost: this.shouldAlignInBrowser(),
        serviceWorkerExpected: true,
        hapticsBackend: 'vibrate',
        clientInstanceStorage: 'localStorage',
      };
    }

    return this.browserCaps();
  }

  private browserCaps(): PlatformCapabilities {
    return {
      surface: 'browser',
      isNative: false,
      shouldAlignApiUrlToPageHost: this.shouldAlignInBrowser(),
      serviceWorkerExpected: true,
      hapticsBackend: 'vibrate',
      clientInstanceStorage: 'localStorage',
    };
  }

  private shouldAlignInBrowser(): boolean {
    if (typeof window === 'undefined') return false;
    const pagePort = window.location.port;
    const isStaticDevPort = pagePort === '8080' || pagePort === '4200';
    if (isStaticDevPort) return false;
    const isNginxPort = pagePort === '' || pagePort === '80' || pagePort === '443';
    return isNginxPort;
  }
}
