#!/usr/bin/env bash
# Ensure pnpm matches web/package.json packageManager.
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

# Never let an installer block the build: `corepack` on PATH may be a foreign shim
# (vite-plus symlinks corepack -> vp) that waits on input forever, and Node 25 dropped
# corepack from the distribution entirely. Everything below runs detached from stdin
# under a wall-clock cap.
run_bounded() {
	local secs="$1"
	shift
	"$@" </dev/null &
	local pid=$! waited=0
	while kill -0 "$pid" 2>/dev/null; do
		if ((waited >= secs)); then
			kill -9 "$pid" 2>/dev/null || true
			wait "$pid" 2>/dev/null || true
			return 124
		fi
		sleep 1
		waited=$((waited + 1))
	done
	wait "$pid"
}

# A corepack that can't answer --version in 10s is a shim we must not hand control to.
corepack_is_usable() {
	command -v corepack >/dev/null 2>&1 &&
		run_bounded 10 corepack --version >/dev/null 2>&1
}

installed=false
if corepack_is_usable; then
	echo "Installing pnpm ${required} via corepack…"
	# prepare activates the shim without a blocking `corepack enable` on some mise setups
	if COREPACK_ENABLE_DOWNLOAD_PROMPT=0 run_bounded 300 corepack prepare "pnpm@${required}" --activate; then
		installed=true
	fi
fi

if [[ "$installed" == false ]] && command -v mise >/dev/null 2>&1; then
	echo "Installing pnpm ${required} via mise…"
	if run_bounded 300 mise use -g "pnpm@${required}"; then
		installed=true
	fi
fi

if [[ "$installed" == false ]] && command -v npm >/dev/null 2>&1; then
	echo "Installing pnpm ${required} via npm…"
	if run_bounded 300 npm install -g "pnpm@${required}"; then
		installed=true
	fi
fi

if [[ "$installed" == false ]]; then
	echo "Could not install pnpm ${required} — tried corepack, mise, npm." >&2
	echo "Install it manually, e.g. \`mise use -g pnpm@${required}\`." >&2
	exit 1
fi

hash -r 2>/dev/null || true
current="$(pnpm --version 2>/dev/null || true)"
if [[ "$current" != "$required" ]]; then
	echo "Expected pnpm ${required}, got ${current:-none}" >&2
	exit 1
fi

echo "pnpm ${current} ready"
