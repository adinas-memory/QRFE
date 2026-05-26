# Capacitor Android (derivat din PWA)

Același codebase Angular servește **browser**, **PWA instalată** și **APK Capacitor**.

## Build matrix

| Scop | Comandă | `apiUrl` | Service worker |
|------|---------|----------|----------------|
| Producție web/PWA | `npm run build` (production) | `https://unrsystem.go.ro` | da (same host) |
| LAN dev (nginx) | `npm run build:devhost` | IP LAN, aliniat la origin :80 | da dacă același host |
| APK Android | `npm run build:capacitor` | prod HTTPS | **nu** |
| Test PWA local | `npm run build:pwa` + `serve:localhost` | `localhost:7051` | dezactivat pe :8080 |

**Nu folosi `devhost` în APK release.** Pentru debug LAN pe tabletă, setează `server.url` în `capacitor.config.ts` către `http://<IP>/` (same-origin).

## Prima instalare Android

```bash
npm install
npm run build:capacitor
npx cap add android   # o singură dată
npm run cap:sync
npm run cap:android   # Android Studio
```

În `android/app/src/main/AndroidManifest.xml` asigură `android.permission.VIBRATE` și `INTERNET`.

## Backend CORS

API-ul trebuie să accepte origin Capacitor (`https://localhost`, `capacitor://localhost`) — configurat în `QR.Api/Program.cs`.

## Componente platformă

| Fișier | Rol |
|--------|-----|
| `runtime-platform.service.ts` | browser / PWA standalone / Capacitor |
| `platform-storage.service.ts` | `localStorage` vs `@capacitor/preferences` |
| `resolve-api-url.ts` | nu rescrie `apiUrl` pe native |
| `device-feedback.service.ts` | `navigator.vibrate` vs `@capacitor/haptics` |
| `pickup-notification.service.ts` | SSE kitchen/bar → haptics |

## Pickup haptics

Vibrează doar dispozitivul cu `ClientInstanceId` egal cu payload-ul SSE (`X-Client-Instance-Id` la mutații staff). Toggle în **Manage orders**.

## QA minim APK

1. Login staff, fără spinner blocat.
2. Modifică comandă → header device id la backend.
3. Kitchen pickup → vibrație doar pe device-ul care a editat comanda.
4. Toggle haptics off → fără vibrație, toast/badge OK.

## Limitări v1

- SSE în foreground (fără background service nativ).
- iOS: separat, același pattern Haptics.
