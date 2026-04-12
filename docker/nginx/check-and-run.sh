#!/bin/sh
set -eu

CERT_DIR="/etc/nginx/certs"
FULLCHAIN="$CERT_DIR/fullchain.pem"
KEYFILE="$CERT_DIR/key.pem"

if [ ! -s "$FULLCHAIN" ]; then
  echo "ERROR: missing TLS certificate: $FULLCHAIN" >&2
  echo "Place fullchain.pem under docker/nginx/certs before starting nginx." >&2
  exit 1
fi

if [ ! -s "$KEYFILE" ]; then
  echo "ERROR: missing TLS private key: $KEYFILE" >&2
  echo "Place key.pem under docker/nginx/certs before starting nginx." >&2
  exit 1
fi

# nginx.conf 内の環境変数プレースホルダーを実際の値に置換
envsubst '${SERVER_NAME}' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
