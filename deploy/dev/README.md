# LAN dev deployment (frontend)

See backend repo [deploy/dev/README.md](https://github.com/adrian-badulescu/QR_Restaurant_backend/blob/main/deploy/dev/README.md) for bootstrap and self-hosted runner setup.

## Build configuration

Uses Angular configuration `devhost` → `environment.devhost.ts` (`apiUrl: http://192.168.43.142`).

## Deploy

- Workflow: `.github/workflows/deploy-dev.yaml` (push `main` or manual dispatch)
- Prod `deploy.yaml`: manual only (does not run on push to `main`)
- Requires a **self-hosted** runner on the LAN (`runs-on: self-hosted` — do not require extra labels unless your runner is configured with them)
- Runner must be assigned to the **QRFE** repository (or an org runner group that lists QRFE)
- GitHub secrets on **QRFE**: `DEV_SERVER_HOST`, `DEV_SERVER_USER`, `DEV_SERVER_SSH_KEY`, `DEV_SERVER_SSH_PORT`

### When does GitHub build/deploy?

| Action | GitHub Actions run? | Server folder |
|--------|---------------------|---------------|
| `git push origin main` | Yes (build on cloud + deploy on self-hosted runner) | `/home/adi/releases/frontend-<run_number>` |
| Actions → **Run workflow** (manual) | Yes, same commit as selected branch | same |
| Only local edits, no push | **No** | unchanged |
| `deploy-from-laptop.ps1` | **No** (bypasses GitHub) | `frontend-<timestamp>` from script |

`frontend-26` is **workflow run #26**, not “May 26”. No push/manual run on the 27th ⇒ no `frontend-27` from CI.

### YAML regression (confirmed in git)

Last known good workflow: commit **`63aed06`** (Actions run **#26**).

| Commit | Problem |
|--------|---------|
| **`13dba48` deployment test 2** | Added `concurrency: cancel-in-progress: true` — rapid pushes cancel queued `verify-runner` / `deploy` before the runner starts them |
| **`5ac7e10`+** | `path: dist/browser`, removed parallel `verify-runner`, `runs-on: [self-hosted, dev]`, local-only deploy experiments |

**Do not** add `concurrency` with `cancel-in-progress` on this workflow. Keep **`verify-runner`** in parallel with **`build`**.

### Troubleshooting runner not picking up jobs

**Symptom:** `build` finishes (~1m30s) but `journalctl` shows no new `Running job:` since the last successful deploy.

1. **Smoke test (isolated):** Actions → **Self-hosted runner smoke test** → Run workflow.  
   On server: `journalctl -u actions.runner.zena-dina.dev -f` — must show `Running job: ping-runner` within ~30s.
2. **GitHub → org/repo → Settings → Actions → Runners:** runner **Idle** (green), not Offline.  
   **Runner groups → Default (or your group) → Repository access** must include **QRFE**.
3. On server: `bash deploy/dev/check-runner-on-server.sh` — check `gitHubUrl` points at **QRFE** (or org with QRFE in the group).
4. Restart listener: `cd ~/actions-runner && sudo ./svc.sh stop && sudo ./svc.sh start`
5. Deploy uses **local paths** on the runner host (no SSH). Requires passwordless sudo (`bootstrap-dev.sh`).

### Troubleshooting deploy failures

1. If **deploy failed**: open logs — expect `browser/` folder after `dist/**` artifact download.
2. `readlink -f /var/www/qrfe-dev` should match `/home/adi/releases/frontend-<run_number>`.

### Register runner for QRFE (one-time)

On `192.168.43.142`, either add a **second** runner for the QRFE repo, or use one **organization** runner whose group includes both repos:

```bash
cd ~/actions-runner-qrfe   # separate folder from backend runner is fine
# GitHub → QRFE repo → Settings → Actions → Runners → New self-hosted runner
./config.sh --url https://github.com/<owner>/QRFE --token <TOKEN> --labels dev,self-hosted
sudo ./svc.sh install && sudo ./svc.sh start
```

Confirm in GitHub: **QRFE → Settings → Actions → Runners** shows **Idle** (green).

## Local deploy from laptop

```powershell
cd deploy\dev
.\deploy-from-laptop.ps1 -SshHost 192.168.43.142 -SshUser adi
```

Requires Node 20+, npm, and OpenSSH.
