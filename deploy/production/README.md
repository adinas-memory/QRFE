# Production frontend deployment

- **Domain:** https://universalrestaurant.systems (`environment.prod.ts`)
- **CI:** push to branch `production` → [`.github/workflows/deploy.yaml`](../../.github/workflows/deploy.yaml)
- **Runner:** self-hosted (192.168.43.142) — build + deploy
- **Backend bootstrap:** `QR_Restaurant_backend/deploy/production/ubuntu/README.md`
- **Secrets / SSH key setup:** `QR_Restaurant_backend/deploy/production/ubuntu/PRODUCTION_CI.md`

## GitHub secrets (QRFE repo)

| Name | Purpose |
|------|---------|
| `PROD_SERVER_HOST` | `universalrestaurant.systems` |
| `PROD_SERVER_USER` | deploy user (`adi`) |
| `PROD_SERVER_SSH_PORT` | optional var, default `2222` |
| `PROD_SERVER_SSH_KEY` | private key `urs_qr_prod_universalrestaurant_systems_ed25519` |
| `URS_ANDROID_RELEASE_TOKEN` | PAT (fine-grained or classic) with **Contents: Read and write** on public repo [`adrian-badulescu/URS-android`](https://github.com/adrian-badulescu/URS-android) — used by [`.github/workflows/android-apk.yaml`](../../.github/workflows/android-apk.yaml) to publish APK releases |

## Branch setup (one time)

```bash
git checkout main && git pull
git checkout -b production && git push -u origin production
```

## Release order

On coordinated releases, deploy **backend** first (migrations), then **frontend**.

## First deploy

See **PRODUCTION_CI.md** in the backend repo (`QR_Restaurant_backend/deploy/production/ubuntu/PRODUCTION_CI.md`) for SSH key generation, full `PROD_*` secret list, and smoke tests.
