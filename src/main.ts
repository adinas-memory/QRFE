/// <reference types="@angular/localize" />

import './app/core/config/resolve-api-url';

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

/** Unregister stale ngsw before first paint (LAN deploys may still have old SW in browser). */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const swOff =
    'serviceWorker' in environment &&
    (environment as { serviceWorker?: boolean }).serviceWorker === false;
  if (swOff) {
    void navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length) {
        void Promise.all(regs.map(r => r.unregister()));
      }
    });
  }
}

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
