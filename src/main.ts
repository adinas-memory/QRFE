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
        // #region agent log
        fetch('http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7379f5'},body:JSON.stringify({sessionId:'7379f5',location:'main.ts:sw-cleanup',message:'unregistering stale service workers',data:{count:regs.length},timestamp:Date.now(),hypothesisId:'H-SW'})}).catch(()=>{});
        // #endregion
      }
    });
  }
}

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
