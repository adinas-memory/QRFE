# LAN dev deployment (frontend)

See backend repo [deploy/dev/README.md](https://github.com/adrian-badulescu/QR_Restaurant_backend/blob/main/deploy/dev/README.md) for bootstrap and self-hosted runner setup.

## Build configuration

Uses Angular configuration `devhost` → `environment.devhost.ts` (`apiUrl: http://192.168.43.142`).

## Deploy

- Workflow: `.github/workflows/deploy-dev.yaml` (push `main` or manual dispatch)
- Prod `deploy.yaml`: manual only (does not run on push to `main`)
- Requires a **self-hosted** runner online on the LAN (see backend `deploy/dev/README.md`)
- GitHub secrets: `DEV_SERVER_HOST`, `DEV_SERVER_USER`, `DEV_SERVER_SSH_KEY`, `DEV_SERVER_SSH_PORT`

### When does GitHub build/deploy?

| Action | GitHub Actions run? | Server folder |
|--------|---------------------|---------------|
| `git push origin main` | Yes (build on cloud + deploy on self-hosted runner) | `/home/adi/releases/frontend-<run_number>` |
| Actions → **Run workflow** (manual) | Yes, same commit as selected branch | same |
| Only local edits, no push | **No** | unchanged |
| `deploy-from-laptop.ps1` | **No** (bypasses GitHub) | `frontend-<timestamp>` from script |

`frontend-26` is **workflow run #26**, not “May 26”. No push/manual run on the 27th ⇒ no `frontend-27` from CI.

### Troubleshooting “nothing on GitHub on day X”

1. **Actions** tab → filter workflow *Deploy Angular Frontend to LAN Dev Server* — any run that day?
2. If **no run**: no `push` to `main` that day (`git log origin/main --since=...`). Push or use **Run workflow**.
3. If **build OK, deploy Queued**: self-hosted runner offline → start runner on dev host (`~/actions-runner/./run.sh` or systemd service).
4. If **deploy failed**: open failed step logs (SSH secrets, `dist/browser` artifact, symlink verify).

## Local deploy from laptop

```powershell
cd deploy\dev
.\deploy-from-laptop.ps1 -SshHost 192.168.43.142 -SshUser adi
```

Requires Node 20+, npm, and OpenSSH.
