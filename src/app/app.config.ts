import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideAppInitializer } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
  withHashLocation,
  withInMemoryScrolling,
  withRouterConfig,
  withViewTransitions
} from '@angular/router';

import { DropdownModule, SidebarModule } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { routes } from './app.routes';
import { CoreModule } from './core/core.module';
import { AuthService } from './core/auth/auth.service';

export function initAuth(authService: AuthService) {
  return () => authService.restoreSession().toPromise();
}

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: provideAppInitializer,
      useFactory: initAuth,
      deps: [AuthService],
      multi: true
    },
    provideRouter(routes,
      withRouterConfig({
        onSameUrlNavigation: 'reload'
      }),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled'
      }),
      withEnabledBlockingInitialNavigation(),
      withViewTransitions(),
      withHashLocation()
    ),    
    importProvidersFrom(CoreModule),
    importProvidersFrom(SidebarModule, DropdownModule),
    IconSetService,
    provideAnimationsAsync()
  ]
};
