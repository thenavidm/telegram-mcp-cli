#!/usr/bin/env bash
# Install telegram-mcp as a systemd service on a Linux server.
#
# Deliberately isolated so it cannot collide with anything already on the box:
#
#   own user      telegrammcp, no login shell, no sudo
#   own directory /var/lib/telegram-mcp, mode 700, owned by that user
#   own port      8788 by default, bound to 127.0.0.1 only
#   own service   telegram-mcp.service
#
# 8788 rather than 8787, because whatsapp-mcp uses 8787 and these boxes tend to
# end up running both.
#
# It binds to loopback, so nothing is exposed to the internet by this script.
# Put it behind your existing reverse proxy, or reach it over an SSH tunnel.
#
# Usage:  sudo bash install.sh [--port 8788]

set -euo pipefail

PORT=8788
while [[ $# -gt 0 ]]; do
  case $1 in
    --port) PORT="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 1 ;;
  esac
done

USER_NAME=telegrammcp
DATA_DIR=/var/lib/telegram-mcp
ENV_FILE=/etc/telegram-mcp.env

[[ $EUID -eq 0 ]] || { echo "run with sudo" >&2; exit 1; }

# Refuse rather than fight for a port something else already holds.
if ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "port ${PORT} is already in use. Pick another with --port." >&2
  exit 1
fi

command -v node >/dev/null || { echo "node is required (20 or newer)" >&2; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' \
  || { echo "node 20 or newer is required" >&2; exit 1; }

# ── the package ──────────────────────────────────────────────────────────
npm install -g @thenavidm/telegram-mcp-cli
BIN="$(command -v telegram-mcp)"
[[ -x "$BIN" ]] || { echo "telegram-mcp not on PATH after install" >&2; exit 1; }

# ── the user and its directory ───────────────────────────────────────────
id -u "$USER_NAME" >/dev/null 2>&1 || \
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$USER_NAME"

mkdir -p "$DATA_DIR"
chown "$USER_NAME:$USER_NAME" "$DATA_DIR"
chmod 700 "$DATA_DIR"

# ── credentials ──────────────────────────────────────────────────────────
# The session string is full access to the account and does not expire, so the
# env file is root-owned and 600. Nothing here is written to the repo.
if [[ ! -f "$ENV_FILE" ]]; then
  HTTP_TOKEN="$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)"
  cat > "$ENV_FILE" <<EOF
# telegram-mcp credentials. Root only, mode 600.
#
# api_id and api_hash come from https://my.telegram.org, API development tools.
# TELEGRAM_SESSION comes from running \`telegram-mcp login\` ON YOUR OWN MACHINE,
# not here: it asks for a phone code interactively. Paste the result below.
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=

# The bearer every proxied request must carry. Generated for you.
TELEGRAM_HTTP_TOKEN=${HTTP_TOKEN}

# Loopback only. The reverse proxy is what faces the internet.
TELEGRAM_HTTP_HOST=127.0.0.1
TELEGRAM_HTTP_PORT=${PORT}

# Every tool, since a hosted server is not paying per-turn context for them.
TELEGRAM_TOOLS=full

# Irreversible tools stay off until you decide otherwise.
# TELEGRAM_ALLOW_DESTRUCTIVE=1
TELEGRAM_AUDIT_LOG=${DATA_DIR}/writes.jsonl
EOF
  chmod 600 "$ENV_FILE"
  echo "wrote ${ENV_FILE}. Fill in the three Telegram values before starting."
fi

# ── the service ──────────────────────────────────────────────────────────
cat > /etc/systemd/system/telegram-mcp.service <<EOF
[Unit]
Description=Telegram MCP server
Documentation=https://github.com/thenavidm/telegram-mcp-cli
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER_NAME}
Group=${USER_NAME}
WorkingDirectory=${DATA_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=${BIN} --http
Restart=always
RestartSec=5

# Telegram rate limits hard and the process reconnects on its own, so a crash
# loop is worse than a slow restart.
StartLimitIntervalSec=60
StartLimitBurst=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable telegram-mcp.service

cat <<EOF

Installed.

  1. Fill in the credentials:
       sudo nano ${ENV_FILE}

     TELEGRAM_SESSION comes from running this ON YOUR LAPTOP, not here:
       npm install -g @thenavidm/telegram-mcp-cli
       telegram-mcp login

  2. Start it:
       sudo systemctl start telegram-mcp
       sudo systemctl status telegram-mcp

  3. Check it answers on loopback:
       curl -s -H "Authorization: Bearer \$(grep TELEGRAM_HTTP_TOKEN ${ENV_FILE} | cut -d= -f2)" \\
         http://127.0.0.1:${PORT}/health

  4. Point your reverse proxy at 127.0.0.1:${PORT}. For Caddy:

       telegram.navid.media {
         reverse_proxy 127.0.0.1:${PORT}
       }

     For nginx, proxy_pass to the same address. The server speaks streamable
     HTTP, so do not buffer responses: proxy_buffering off.

  5. Read the bearer token back when you need it:
       sudo grep TELEGRAM_HTTP_TOKEN ${ENV_FILE}

EOF
