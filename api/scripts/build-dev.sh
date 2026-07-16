#!/usr/bin/env bash
# Build the API for local air/dev.
# Prefers OCR (gosseract + Tesseract); falls back to a no-OCR binary if libs are missing.
set -euo pipefail

cd "$(dirname "$0")/.."

OUT="${1:-./tmp/server}"
mkdir -p "$(dirname "$OUT")"

resolve_brew_prefix() {
  if command -v brew >/dev/null 2>&1; then
    brew --prefix 2>/dev/null && return 0
  fi
  local tess
  tess="$(command -v tesseract 2>/dev/null || true)"
  if [[ -n "$tess" ]]; then
    dirname "$(dirname "$tess")"
    return 0
  fi
  return 1
}

build_with_ocr() {
  local brew
  brew="$(resolve_brew_prefix)" || return 1
  local tess_inc lept_inc tess_lib lept_lib
  tess_inc="$brew/opt/tesseract/include"
  lept_inc="$brew/opt/leptonica/include"
  tess_lib="$brew/opt/tesseract/lib"
  lept_lib="$brew/opt/leptonica/lib"
  if [[ ! -f "$lept_inc/leptonica/allheaders.h" ]]; then
    return 1
  fi
  CGO_ENABLED=1 \
    CGO_CPPFLAGS="-I${tess_inc} -I${lept_inc}" \
    CGO_LDFLAGS="-L${tess_lib} -L${lept_lib} -ltesseract -lleptonica" \
    go build -tags tesseract -o "$OUT" ./cmd/server
}

build_without_ocr() {
  CGO_ENABLED=0 go build -o "$OUT" ./cmd/server
}

if build_with_ocr; then
  echo "built $OUT (ocr: tesseract)"
else
  echo "warn: tesseract/leptonica not usable — building without OCR" >&2
  build_without_ocr
  echo "built $OUT (ocr: disabled)"
fi
