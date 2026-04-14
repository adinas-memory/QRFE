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
import { loggingInterceptor } from './core/interceptors/logging.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { LANG_STORAGE_KEY, DEFAULT_LANG, translocoConfig, type AppLang, APP_LANGS } from './core/i18n/transloco.config';

export function initAuth(authService: AuthService) {
  return () => authService.restoreSession().toPromise();
}

function initLanguage(transloco: TranslocoService) {
  return () => {
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
        authInterceptor,
        loggingInterceptor
      ])
    ),
    importProvidersFrom(SidebarModule, DropdownModule),
    IconSetService,
    provideTransloco({
      config: translocoConfig,
      loader: TranslocoHttpLoader
    }),
    provideAnimationsAsync(), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
  ]
};
