# Capacitor Android (derivat din PWA)

Același codebase Angular servește **browser**, **PWA instalată** și **APK Capacitor**.

## Build matrix

| Scop | Comandă | `apiUrl` | Service worker | Capacitor `server.url` |
|------|---------|----------|----------------|------------------------|
| Producție web/PWA | `npm run build` (production) | `https://universalrestaurant.systems` | da (same host) | — |
| LAN dev (nginx) | `npm run build:devhost` | IP LAN, aliniat la origin :80 | nu | — |
| **APK release (prod)** | `npm run android:prod` | prod HTTPS | **nu** | **nu** (bundle local) |
| APK LAN tabletă (live reload) | `npm run android:lan` | IP LAN | **nu** | da (live reload LAN) |
| **APK LAN standalone** | `npm run android:lan-apk` | IP LAN | **nu** | **nu** (`androidScheme: http`) |
| Test PWA local | `npm run build:pwa` + `serve:localhost` | `localhost:7051` | dezactivat pe :8080 | — |

**Nu folosi `capacitor-lan` / `android:lan` pentru APK release.** Release-ul folosește assets bundled + HTTPS prod.

## Release APK intern (semnat)

```bash
npm install
npm run android:prod
npm run cap:android   # Android Studio
```

În Android Studio: **Build → Generate Signed Bundle / APK → APK**

1. Creează sau selectează keystore local (nu se commită în git).
2. Alege **release** build variant.
3. Instalează APK-ul pe tabletă (sideload / MDM).

Alternativ, build headless (necesită signing configurat în `android/app/build.gradle`):

```bash
npm run android:release
# APK: android/app/build/outputs/apk/release/app-release-unsigned.apk
# Semnează în Studio sau adaugă signingConfigs release.
```

**Versioning:** la fiecare release, incrementează `versionCode` și `versionName` în `android/app/build.gradle`.

## Debug LAN pe tabletă

### Live reload (UI de pe nginx)

```bash
npm run android:lan
```

### APK standalone (assets în APK, fără nginx pentru UI)

```bash
npm run android:lan-apk
# apoi Build APK în Android Studio
```

Folosește `environment.capacitor.lan.ts` + `cap-sync-lan-apk.mjs`. Setează `androidScheme: http` (origin `http://localhost`). **Nu** seta `hostname` la IP-ul API — Capacitor interceptează request-urile și returnează HTML. Auth pe native folosește Bearer tokens (`X-URS-Native-Auth`).

**Nu folosi** doar `npx cap sync` după `build:capacitor-lan` — lipsește `androidScheme: http`.

Pentru LAN cu cleartext HTTP, poți seta temporar `android:usesCleartextTraffic="true"` și adăuga IP-ul în `network_security_config.xml` — **nu** include asta în build-ul de producție.

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
| `pull-to-refresh-host.component.ts` | swipe-down refresh pe layout staff |

## Pull-to-refresh (staff)

Pe layout-ul staff (orders, kitchen, bar): trage de sus în jos când scroll-ul e la top → `GET /api/sync` forțat. Dezactivat offline sau când un modal/offcanvas e deschis.

## Offline sync countdown (Android)

La reconectare după offline, toate tabletele aceluiași restaurant așteaptă **0–60 s** (delay determinist anti–thundering herd) înainte de drain coadă / reconciliere. UI modal cu număr invers apare **doar pe Manage Orders**; kitchen/bar sincronizează în fundal cu aceeași logică.

## Pickup haptics

Vibrează doar dispozitivul cu `ClientInstanceId` egal cu payload-ul SSE (`X-Client-Instance-Id` la mutații staff). Toggle în **Manage orders**.

## QA minim APK release

1. Login staff, fără spinner blocat.
2. Request-uri API către `https://universalrestaurant.systems` (nu LAN).
3. Modifică comandă → header device id la backend.
4. Kitchen pickup → vibrație doar pe device-ul care a editat comanda.
5. Toggle haptics off → fără vibrație, toast/badge OK.
6. Offline → online → countdown + sync pe Manage Orders.
7. Pull-to-refresh pe orders/kitchen când ești online.

## Limitări v1

- SSE în foreground (fără background service nativ).
- Countdown reconnect vizibil doar pe Manage Orders (kitchen/bar: sync fără modal).
- iOS: separat, același pattern Haptics.
