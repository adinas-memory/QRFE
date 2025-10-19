// core.module.ts
import { EnvironmentProviders, importProvidersFrom, NgModule, Optional, SkipSelf } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { AuthService } from './auth/auth.service';


// Import your interceptors
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor'; // example

@NgModule({
  providers: [
    AuthService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoggingInterceptor,
      multi: true,
    },
  ],
})
export class CoreModule { 
      static forRoot(): EnvironmentProviders {
    return importProvidersFrom(CoreModule);
  }
}
