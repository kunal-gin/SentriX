#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: sudo ./scripts/enroll-agent.sh <server_host> <server_port> <enrollment_token> <agent_version>" >&2
  exit 1
fi

SERVER_HOST="$1"
SERVER_PORT="$2"
ENROLLMENT_TOKEN="$3"
AGENT_VERSION="$4"

HOSTNAME="$(hostname)"
PLATFORM="linux"
ARCH="$(uname -m)"

RESPONSE="$(
  curl -sS -X POST "http://${SERVER_HOST}:${SERVER_PORT}/api/v1/agent/enroll" \
    -H 'Content-Type: application/json' \
    -d '{
      "token": "'"${ENROLLMENT_TOKEN}"'",
      "hostname": "'"${HOSTNAME}"'",
      "platform": "'"${PLATFORM}"'",
      "architecture": "'"${ARCH}"'",
      "agent_version": "'"${AGENT_VERSION}"'"
    }'
)"

if ! echo "$RESPONSE" | grep -q '"agent_id"'; then
  echo "Enrollment failed:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

AGENT_ID="$(echo "$RESPONSE" | sed -n 's/.*"agent_id":"\([^"]*\)".*/\1/p')"
CREDENTIAL="$(echo "$RESPONSE" | sed -n 's/.*"credential":"\([^"]*\)".*/\1/p')"

if [[ -z "$AGENT_ID" || -z "$CREDENTIAL" ]]; then
  echo "Failed to parse enrollment response." >&2
  exit 1
fi

install -d /etc/sentrix

cat > /etc/sentrix/agent.env <<EOF
SENTRIX_SERVER_HOST=${SERVER_HOST}
SENTRIX_SERVER_PORT=${SERVER_PORT}
SENTRIX_AGENT_ID=${AGENT_ID}
SENTRIX_AGENT_CREDENTIAL=${CREDENTIAL}
EOF

chmod 0640 /etc/sentrix/agent.env

if id -u sentrix >/dev/null 2>&1; then
  chown root:sentrix /etc/sentrix/agent.env
fi

echo "Agent enrolled successfully."
echo "Agent ID: ${AGENT_ID}"
echo "Configuration written to /etc/sentrix/agent.env"
