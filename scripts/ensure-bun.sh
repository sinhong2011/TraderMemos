#!/usr/bin/env bash
set -euo pipefail

required="1.4.0"
bun_home="${BUN_INSTALL:-$HOME/.bun}"
bun_bin="${bun_home}/bin/bun"

bun_version() {
	if [[ -x "$bun_bin" ]]; then
		"$bun_bin" --version
		return
	fi
	if command -v bun >/dev/null 2>&1; then
		bun --version
	fi
}

current="$(bun_version || true)"
if [[ "$current" == "$required"* ]]; then
	case ":${PATH}:" in
	*":${bun_home}/bin:"*) ;;
	*) export PATH="${bun_home}/bin:${PATH}" ;;
	esac
	exit 0
fi

echo "Installing Bun ${required} canary (mise does not publish canary builds yet)..."
curl -fsSL https://bun.sh/install | bash -s canary

if [[ ! -x "$bun_bin" ]]; then
	echo "Bun install did not create ${bun_bin}" >&2
	exit 1
fi

current="$("$bun_bin" --version)"
if [[ "$current" != "$required"* ]]; then
	echo "Expected Bun ${required} canary at ${bun_bin}, got ${current}" >&2
	exit 1
fi

# mise shims can shadow ~/.bun/bin; prefer the canary install for this repo.
case ":${PATH}:" in
*":${bun_home}/bin:"*) ;;
*) export PATH="${bun_home}/bin:${PATH}" ;;
esac
