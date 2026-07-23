#!/usr/bin/env bash
# Ensure pnpm matches web/package.json packageManager (Node 24+ / Corepack).
set -euo pipefail

required="11.16.0"
root="$(cd "$(dirname "$0")/.." && pwd)"
pkg_mgr="$(node -p "require('${root}/web/package.json').packageManager" 2>/dev/null || true)"
if [[ "$pkg_mgr" == pnpm@* ]]; then
	required="${pkg_mgr#pnpm@}"
fi

if command -v pnpm >/dev/null 2>&1; then
	current="$(pnpm --version 2>/dev/null || true)"
	if [[ "$current" == "$required" ]]; then
		echo "pnpm ${current} ready"
		exit 0
	fi
fi

if ! command -v corepack >/dev/null 2>&1; then
	echo "Node.js with Corepack is required (Node 24 LTS)." >&2
	exit 1
fi

# prepare activates the shim without a blocking `corepack enable` on some mise setups
corepack prepare "pnpm@${required}" --activate

current="$(pnpm --version)"
if [[ "$current" != "$required" ]]; then
	echo "Expected pnpm ${required}, got ${current}" >&2
	exit 1
fi

echo "pnpm ${current} ready"
