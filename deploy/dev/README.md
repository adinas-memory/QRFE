# LAN dev deployment (frontend)

See backend repo [deploy/dev/README.md](https://github.com/adrian-badulescu/QR_Restaurant_backend/blob/main/deploy/dev/README.md) for bootstrap and self-hosted runner setup.

## Build configuration

Uses Angular configuration `devhost` → `environment.devhost.ts` (`apiUrl: http://192.168.43.142`).

## Deploy

- Workflow: `.github/workflows/deploy-dev.yaml` (push `main` or manual dispatch)
- Prod `deploy.yaml`: manual only (does not run on push to `main`)
- Requires self-hosted runner with label `dev` on the LAN host
- GitHub secrets: `DEV_SERVER_HOST`, `DEV_SERVER_USER`, `DEV_SERVER_SSH_KEY`, `DEV_SERVER_SSH_PORT`

## Local deploy from laptop

```powershell
cd deploy\dev
.\deploy-from-laptop.ps1 -SshHost 192.168.43.142 -SshUser adi
```

Requires Node 20+, npm, and OpenSSH.
