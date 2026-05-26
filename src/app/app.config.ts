import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, inject, provideAppInitializer, isDevMode } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withDebugTracing,
  withEnabledBlockingInitialNavigation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions
} from '@angular/router';

import { DropdownModule, SidebarModule } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { clientInstanceInterceptor } from './core/interceptors/client-instance.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { LANG_STORAGE_KEY, DEFAULT_LANG, translocoConfig, type AppLang, APP_LANGS } from './core/i18n/transloco.config';
import { environment } from '../environments/environment';

function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.() === true
  );
}

/** SW + credentialed API cookies require the same host (localhost vs LAN IP are different sites). */
function isServiceWorkerEnabled(): boolean {
  if (isDevMode()) return false;
  if (isCapacitorNative()) return false;
  if ('serviceWorker' in environment && environment.serviceWorker === false) return false;
  if (typeof window === 'undefined') return true;
  try {
    const apiHost = new URL(environment.apiUrl).hostname;
    const pageHost = window.location.hostname;
    if (apiHost !== pageHost) {
      console.warn(
        `[QRFE] Service worker disabled: API host "${apiHost}" != page host "${pageHost}". ` +
          `On localhost use "npm run serve:localhost" (build:pwa). On LAN use build:devhost at your IP.`
      );
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Drop stale ngsw from earlier devhost builds (e.g. after deploy restored an SW-enabled release). */
export function initServiceWorkerCleanup() {
  return async () => {
    if (isServiceWorkerEnabled()) return;
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return;
    await Promise.all(regs.map((r) => r.unregister()));
    console.warn(`[QRFE] Unregistered ${regs.length} service worker(s) (devhost / LAN).`);
  };
}

export function initAuth(authService: AuthService) {
  return () => authService.restoreSession().toPromise();
}

/** Ensures `/assets/i18n/{lang}.json` is loaded before the app renders; avoids Transloco "Missing translation" races. */
function initLanguage(transloco: TranslocoService) {
  return async () => {
    let lang: AppLang = DEFAULT_LANG;
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored && (APP_LANGS as readonly string[]).includes(stored)) {
        lang = stored as AppLang;
      }
    } catch {
      // ignore
    }
    transloco.setActiveLang(lang);
    await firstValueFrom(transloco.load(lang));
    const fallback = transloco.config.fallbackLang as AppLang | undefined;
    if (fallback && fallback !== lang) {
      await firstValueFrom(transloco.load(fallback));
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initServiceWorkerCleanup,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initLanguage,
      deps: [TranslocoService],
      multi: true
    },
    provideRouter(routes,
      // withDebugTracing(),
      withRouterConfig({
        onSameUrlNavigation: 'reload'
      }),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled'
      }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions()
    ),
    provideHttpClient(
      withInterceptors([
        loadingInterceptor,
        authInterceptor,
        clientInstanceInterceptor,
        loggingInterceptor
      ])
    ),
    importProvidersFrom(SidebarModule, DropdownModule),
    IconSetService,
    provideTransloco({
      config: translocoConfig,
      loader: TranslocoHttpLoader
    }),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: isServiceWorkerEnabled(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
