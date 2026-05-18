#!/usr/bin/env bash
# Sourced from deploy-dev.yaml verify step. Emits diagnostics + agent log (session 7379f5).
if grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-}"
LOG_ENDPOINT="${LOG_ENDPOINT:-http://127.0.0.1:7278/ingest/659d4b68-7820-48ed-a0b7-72ad405fac18}"
SESSION_ID="${SESSION_ID:-7379f5}"

agent_log() {
  local hypothesisId="$1"
  local message="$2"
  local data_json="$3"
  curl -s -X POST "$LOG_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -H "X-Debug-Session-Id: ${SESSION_ID}" \
    -d "{\"sessionId\":\"${SESSION_ID}\",\"hypothesisId\":\"${hypothesisId}\",\"location\":\"deploy-dev-diagnose-sudo.sh\",\"message\":\"${message}\",\"data\":${data_json},\"timestamp\":$(date +%s)000}" \
    >/dev/null 2>&1 || true
}

echo "=== Deploy SSH/sudo diagnostics ==="
echo "runner_host=$(hostname)"
echo "runner_user=$(whoami)"
echo "ssh_config_user=${DEPLOY_USER}"
echo "ssh_target_host=$(ssh -G dev-deploy 2>/dev/null | awk '/^hostname /{print $2}')"
echo "ssh_target_port=$(ssh -G dev-deploy 2>/dev/null | awk '/^port /{print $2}')"

ACTUAL_USER="$(ssh dev-deploy 'whoami' 2>/dev/null | tr -d '\r\n')"
echo "ssh_remote_whoami=${ACTUAL_USER}"

SUDOERS_READABLE="$(ssh dev-deploy 'test -r /etc/sudoers.d/qr-dev-deploy && echo yes || echo no' 2>/dev/null || echo unknown)"
SUDO_NOPASS="$(ssh dev-deploy 'sudo -n true 2>/dev/null && echo yes || echo no' 2>/dev/null || echo unknown)"
SUDO_L_HEAD="$(ssh dev-deploy 'sudo -n -l 2>/dev/null | head -5' || true)"

echo "sudoers_file_readable_by_ssh_user=${SUDOERS_READABLE}"
echo "sudo_nopass_for_ssh_user=${SUDO_NOPASS}"
echo "sudo_l_head:"
echo "${SUDO_L_HEAD}"

agent_log "A" "ssh identity" "{\"secret_user\":\"${DEPLOY_USER}\",\"remote_whoami\":\"${ACTUAL_USER}\",\"match\":$([ \"${ACTUAL_USER}\" = \"${DEPLOY_USER}\" ] && echo true || echo false)}"
agent_log "B" "sudo nopass" "{\"sudo_nopass\":\"${SUDO_NOPASS}\"}"
agent_log "C" "ssh target" "{\"host\":\"$(ssh -G dev-deploy 2>/dev/null | awk '/^hostname /{print $2}')\",\"port\":\"$(ssh -G dev-deploy 2>/dev/null | awk '/^port /{print $2}')\"}"

if [[ -n "${DEPLOY_USER}" && "${ACTUAL_USER}" != "${DEPLOY_USER}" ]]; then
  echo "::error::SSH user mismatch: remote whoami='${ACTUAL_USER}' but DEV_SERVER_USER='${DEPLOY_USER}'. Run on server: sudo bash install-sudoers.sh ${ACTUAL_USER}"
  agent_log "A" "mismatch exit" "{\"reason\":\"user_mismatch\"}"
  exit 1
fi

if [[ "${SUDO_NOPASS}" != "yes" ]]; then
  echo "::error::NOPASSWD sudo failed for '${ACTUAL_USER}'. On the SSH target host run: sudo bash install-sudoers.sh ${ACTUAL_USER}"
  agent_log "B" "nopass failed" "{\"user\":\"${ACTUAL_USER}\"}"
  exit 1
fi

echo "NOPASSWD sudo: OK"
agent_log "B" "nopass ok" "{\"user\":\"${ACTUAL_USER}\"}"
