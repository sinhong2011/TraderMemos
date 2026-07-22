#!/usr/bin/env bash
# Build the API for local air/dev (no CGO / tesseract).
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="${1:-./tmp/server}"
mkdir -p "$(dirname "$OUT")"

CGO_ENABLED=0 go build -o "$OUT" ./cmd/server
echo "built $OUT"
