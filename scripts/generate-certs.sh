#!/usr/bin/env bash
# generate-certs.sh — create a self-signed TLS certificate for LAN HTTPS
#
# Usage:
#   ./scripts/generate-certs.sh <LAN_IP>
#
# Example:
#   ./scripts/generate-certs.sh 192.168.1.42
#
# Outputs ./certs/fullchain.pem and ./certs/privkey.pem.
# These are bind-mounted read-only into the nginx container by
# docker-compose.prod.yml.
#
# Notes:
#   - Valid for 825 days (macOS/iOS trust store cap)
#   - SAN covers localhost, 127.0.0.1, and your LAN IP
#   - Browsers will still warn on first visit — click "Advanced → Proceed"
#   - Requires openssl to be installed on the host

set -euo pipefail

LAN_IP="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/../certs"

if [[ -z "$LAN_IP" ]]; then
  echo "Error: LAN IP address is required."
  echo ""
  echo "Usage: $0 <LAN_IP>"
  echo "Example: $0 192.168.1.42"
  echo ""
  echo "To find your LAN IP on Linux/macOS: hostname -I | awk '{print \$1}'"
  echo "To find your LAN IP on Windows:     ipconfig | findstr IPv4"
  exit 1
fi

mkdir -p "$OUT_DIR"

# Write a temporary OpenSSL config with Subject Alternative Names
CNF_FILE="${OUT_DIR}/openssl.cnf"
cat > "$CNF_FILE" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions    = v3_req
prompt             = no

[req_distinguished_name]
C  = GB
ST = Local
L  = Local
O  = Shared Living Manager
CN = shared-living-manager.local

[v3_req]
subjectAltName   = @alt_names
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
basicConstraints = CA:FALSE

[alt_names]
DNS.1 = localhost
DNS.2 = shared-living-manager.local
IP.1  = 127.0.0.1
IP.2  = ${LAN_IP}
EOF

echo "Generating self-signed certificate for: localhost, 127.0.0.1, ${LAN_IP}"

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "${OUT_DIR}/privkey.pem"   \
  -out    "${OUT_DIR}/fullchain.pem" \
  -config "${CNF_FILE}"

chmod 600 "${OUT_DIR}/privkey.pem"
chmod 644 "${OUT_DIR}/fullchain.pem"

echo ""
echo "Done. Certificates written to ${OUT_DIR}/"
echo "  fullchain.pem  (certificate)"
echo "  privkey.pem    (private key — keep this secret)"
echo ""
echo "Next steps:"
echo "  1. cp .env.prod.example .env.prod"
echo "     Edit .env.prod — set FRONTEND_URL=https://${LAN_IP} and update secrets."
echo ""
echo "  2. docker compose -f docker-compose.prod.yml --env-file .env.prod build"
echo "     docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
echo ""
echo "  3. Open https://${LAN_IP}/ in your browser."
echo "     Accept the self-signed certificate warning on first visit."
