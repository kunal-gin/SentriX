#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: sudo ./scripts/install-agent.sh /path/to/sentrix-agent" >&2
  exit 1
fi

BINARY="$1"

if [[ ! -f "$BINARY" ]]; then
  echo "Agent binary not found: $BINARY" >&2
  exit 1
fi

echo "Creating sentrix user if needed..."

if ! id -u sentrix >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin sentrix
fi

echo "Creating directories..."

install -d /opt/sentrix/bin
install -d /etc/sentrix

echo "Installing agent binary..."

install -m 0755 "$BINARY" /opt/sentrix/bin/sentrix-agent

if [[ ! -f /etc/sentrix/agent.env ]]; then
  echo "Installing example agent environment file..."
  install -m 0640 deploy/agent/agent.env.example /etc/sentrix/agent.env
  chown root:sentrix /etc/sentrix/agent.env
fi

echo "Installing systemd unit..."

install -m 0644 deploy/systemd/sentrix-agent.service /etc/systemd/system/sentrix-agent.service

systemctl daemon-reload

echo ""
echo "Agent installed."
echo ""
echo "Next steps:"
echo "  1. Enroll the agent or manually fill /etc/sentrix/agent.env"
echo "  2. systemctl enable --now sentrix-agent"
echo "  3. journalctl -u sentrix-agent -f"
