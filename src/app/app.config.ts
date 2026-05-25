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
import { navigationCancelInterceptor } from './core/interceptors/navigation-cancel.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { clientInstanceInterceptor } from './core/interceptors/client-instance.interceptor';
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { LANG_STORAGE_KEY, DEFAULT_LANG, translocoConfig, type AppLang, APP_LANGS } from './core/i18n/transloco.config';
import { environment } from '../environments/environment';

/** SW must not intercept /api or /sse on static-only dev servers (localhost:8080). */
function isServiceWorkerEnabled(): boolean {
  if (isDevMode()) return false;
  if (typeof window === 'undefined') return true;
  try {
    const pageHost = window.location.hostname;
    const pagePort = window.location.port;
    if (
      (pageHost === 'localhost' || pageHost === '127.0.0.1') &&
      pagePort !== '' &&
      pagePort !== '80' &&
      pagePort !== '443'
    ) {
      console.warn(
        `[QRFE] Service worker disabled on ${window.location.origin} (static dev server; API/SSE use configured apiUrl).`
      );
      return false;
    }
    const apiHost = new URL(environment.apiUrl).hostname;
    if (apiHost !== pageHost) {
      console.warn(
        `[QRFE] Service worker disabled: API host "${apiHost}" != page host "${pageHost}". ` +
          `Use ng serve, or open the app at the API host (e.g. http://192.168.43.142/).`
      );
      return false;
    }
    return true;
  } catch {
    return true;
  }
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
        navigationCancelInterceptor,
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
