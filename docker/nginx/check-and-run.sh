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

exec nginx -g 'daemon off;'
