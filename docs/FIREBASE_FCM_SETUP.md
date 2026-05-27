# Firebase / FCM (Android staff app)

See also backend: `QR_Restaurant_backend/docs/FIREBASE_FCM_SETUP.md`

## Android package

- `applicationId`: `com.universal_restaurant_system.pos`
- Place Firebase `google-services.json` in `android/app/google-services.json`

## After adding google-services.json

```bash
npm install
npx cap sync android
```

Rebuild and reinstall the APK on the device.
