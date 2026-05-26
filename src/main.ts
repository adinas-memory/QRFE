/// <reference types="@angular/localize" />

import './app/core/config/resolve-api-url';

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

// #region agent log
if (typeof window !== 'undefined') {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7379f5' },
    body: JSON.stringify({
      sessionId: '7379f5',
      hypothesisId: 'H-cap-start',
      location: 'main.ts:bootstrap',
      message: 'Angular bootstrap on device',
      data: {
        pageOrigin: window.location.origin,
        apiUrl: environment.apiUrl,
        isNative: cap?.isNativePlatform?.() === true,
        platform: cap?.getPlatform?.() ?? 'web',
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
