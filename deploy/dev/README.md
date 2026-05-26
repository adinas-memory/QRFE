# LAN dev deployment (frontend)

See backend repo [deploy/dev/README.md](https://github.com/adrian-badulescu/QR_Restaurant_backend/blob/main/deploy/dev/README.md) for bootstrap and self-hosted runner setup.

## Build configuration

Uses Angular configuration `devhost` → `environment.devhost.ts` (`apiUrl: http://192.168.43.142`).

## Deploy

- Workflow: `.github/workflows/deploy-dev.yaml` (push `main` or manual dispatch)
- Prod `deploy.yaml`: manual only (does not run on push to `main`)
- Requires a **self-hosted** runner on the LAN with labels **`self-hosted`** and **`dev`**
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

### Troubleshooting “nothing on GitHub on day X”

1. **Actions** tab → filter workflow *Deploy Angular Frontend to LAN Dev Server* — any run that day?
2. If **no run**: no `push` to `main` that day (`git log origin/main --since=...`). Push or use **Run workflow**.
3. If **build OK, deploy Queued forever**: runner not registered for **QRFE** (backend-only runner does not pick FE jobs), or org **Runner group → Repository access** excludes QRFE, or runner offline (`sudo ~/actions-runner/svc.sh status`).
4. If **build ~1m30s and deploy never runs / Cancelled**: rapid pushes used to cancel queued deploy jobs; workflow no longer uses `cancel-in-progress`.
5. If **deploy failed**: open failed step logs (SSH secrets, `dist/browser` artifact, symlink verify).

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
