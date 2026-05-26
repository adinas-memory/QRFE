#!/usr/bin/env bash
# Run on the dev host as the user that owns the Actions runner (usually adi).
set -euo pipefail

RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"

echo "=== systemd ==="
systemctl is-active "actions.runner."* 2>/dev/null || systemctl status 'actions.runner.*' --no-pager || true

echo ""
echo "=== runner config (.runner) ==="
if [[ -f "$RUNNER_DIR/.runner" ]]; then
  python3 - <<'PY' "$RUNNER_DIR/.runner" 2>/dev/null || cat "$RUNNER_DIR/.runner"
import json, sys
d = json.load(open(sys.argv[1]))
print("agentName:", d.get("agentName"))
print("gitHubUrl:", d.get("gitHubUrl"))
print("poolName:", d.get("poolName"))
print("serverUrl:", d.get("serverUrl"))
PY
else
  echo "Missing $RUNNER_DIR/.runner"
fi

echo ""
echo "=== recent listener log (journal) ==="
journalctl -u 'actions.runner.*' -n 15 --no-pager 2>/dev/null || true

echo ""
echo "=== nginx frontend symlink ==="
readlink -f /var/www/qrfe-dev 2>/dev/null || echo "(no qrfe-dev symlink)"

echo ""
echo "If GitHub shows runner Offline but service is active, restart:"
echo "  cd $RUNNER_DIR && sudo ./svc.sh stop && sudo ./svc.sh start"
echo "Then re-run workflow 'Self-hosted runner smoke test' on QRFE repo."
