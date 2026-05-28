/// <reference types="@angular/localize" />

import './app/core/config/resolve-api-url';

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

// #region agent log
function __dbgOverlay(id: string, text: string, color: string, top: number): void {
  try {
    if (typeof document === 'undefined') return;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = `position:fixed;left:0;top:${top}px;z-index:2147483647;background:${color};color:#fff;font:11px/14px monospace;padding:2px 6px;max-width:100vw;word-break:break-all;white-space:pre-wrap;pointer-events:none;`;
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
  } catch { /* ignore */ }
}
(window as any).__dbgOverlay = __dbgOverlay;
__dbgOverlay('__dbg_main', '[1] main.ts ran cap-fix-1 ' + new Date().toISOString().slice(11, 19), '#c62828', 0);

window.addEventListener('error', (e) => {
  __dbgOverlay('__dbg_err', '[ERR] ' + (e?.message ?? 'unknown') + ' @ ' + (e?.filename ?? '') + ':' + (e?.lineno ?? ''), '#6a1b9a', 60);
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  let msg = 'unhandled';
  try { msg = String((e?.reason as { message?: unknown })?.message ?? e?.reason ?? 'unhandled'); } catch { /* ignore */ }
  __dbgOverlay('__dbg_rej', '[REJ] ' + msg, '#ad1457', 80);
});
// #endregion agent log

/** Unregister stale ngsw before first paint (LAN deploys may still have old SW in browser). */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const swOff =
    'serviceWorker' in environment &&
    (environment as { serviceWorker?: boolean }).serviceWorker === false;
  if (swOff) {
    void navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length) {
        // #region agent log
        __dbgOverlay('__dbg_sw', '[SW] unregistering ' + regs.length + ' worker(s)', '#1565c0', 20);
        // #endregion agent log
        void Promise.all(regs.map(r => r.unregister()));
      }
    });
  }
}

// #region agent log
__dbgOverlay('__dbg_boot', '[2] bootstrapApplication(...) called', '#ef6c00', 40);
// #endregion agent log
bootstrapApplication(AppComponent, appConfig)
  // #region agent log
  .then(() => __dbgOverlay('__dbg_boot', '[2b] bootstrap RESOLVED', '#2e7d32', 40))
  // #endregion agent log
  .catch(err => {
    console.error(err);
    // #region agent log
    let msg = 'unknown';
    try { msg = String((err as { message?: unknown })?.message ?? err); } catch { /* ignore */ }
    __dbgOverlay('__dbg_boot', '[2x] bootstrap REJECTED: ' + msg, '#6a1b9a', 40);
    // #endregion agent log
  });
