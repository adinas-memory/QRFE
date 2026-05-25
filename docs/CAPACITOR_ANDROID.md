# Capacitor Android wrapper (Phase 2)

Phase 1 (web/PWA) implements pickup haptics via `navigator.vibrate(500)` and a stable `ClientInstanceService` id in `localStorage`. This document describes the follow-up Android app shell.

## Goals

- Ship a native Android app that loads the Angular PWA build (`ng build --configuration=pwa`).
- Reuse the same API, SSE (`fetch-event-source`), and cookie-based staff auth.
- Replace web-only vibration with `@capacitor/haptics` (or a vibration plugin) while keeping `DeviceFeedbackService` as the single call site.

## Recommended layout

```
QRFE/
  src/                 # Angular app (existing)
  capacitor.config.ts
  android/             # `npx cap add android`
```

## Packages

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
- `@capacitor/preferences` — persist `qrfe-client-instance-id` (migrate from `localStorage` on first launch)
- `@capacitor/haptics` — `impact({ style: ImpactStyle.Medium })` or duration-based vibration

## Adaptations from Phase 1

| Component | Web (Phase 1) | Android |
|-----------|---------------|---------|
| `ClientInstanceService` | `localStorage` | `@capacitor/preferences` |
| `DeviceFeedbackService` | `navigator.vibrate(500)` | Capacitor Haptics API |
| HTTP / SSE | Browser | Verify cookies with `CapacitorHttp` if needed |
| Permissions | — | `android.permission.VIBRATE` in `AndroidManifest.xml` |

## Build pipeline

1. `npm run build:pwa`
2. `npx cap sync android`
3. Open `android/` in Android Studio → assemble APK/AAB

Set `environment.apiUrl` to the production API. Default WebView entry should land on staff routes (e.g. `/staff/manage-orders`) after login.

## Out of scope (initial Android release)

- iOS / App Store
- Native push notifications
- Background SSE (foreground-only at first)

## iOS (later)

Safari often blocks `navigator.vibrate`; plan a separate Capacitor iOS target with `@capacitor/haptics` and App Store distribution when ready.
