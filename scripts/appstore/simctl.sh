#!/bin/bash
# Drive a booted iOS simulator to capture store screenshots.
#
#   scripts/appstore/simctl.sh ui                 # dump the a11y tree with tap points
#   scripts/appstore/simctl.sh tap <x> <y>        # tap (POINTS, not pixels)
#   scripts/appstore/simctl.sh swipe <x1> <y1> <x2> <y2> [secs]
#   scripts/appstore/simctl.sh type "text"
#   scripts/appstore/simctl.sh shot <name>        # → captures/ios/<name>.png
#   scripts/appstore/simctl.sh chrome             # 9:41, full bars, dark mode
#
# Override the target with UDID=<udid>. Defaults to the first booted device.
#
# Two traps this wrapper exists to avoid:
#
#   1. axe speaks POINTS (440x956 on a 6.9" iPhone), while screenshots come out
#      in PIXELS (1320x2868). Passing pixel coordinates taps off-screen and the
#      command still reports success.
#   2. axe needs DEVELOPER_DIR pointed at the xcode-shim, but `xcrun simctl`
#      breaks under that same variable — screenshots silently never get written.
#      So it is scoped to the axe invocation and never exported.

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
UDID="${UDID:-$(xcrun simctl list devices booted -j | python3 -c 'import json,sys
d=json.load(sys.stdin)["devices"]
print(next(dev["udid"] for r in d.values() for dev in r), end="")' 2>/dev/null)}"

if [ -z "$UDID" ]; then echo "no booted simulator" >&2; exit 1; fi
AXE=(env DEVELOPER_DIR=/private/tmp/xcode-shim axe)
OUT="$HERE/captures/ios"

case "${1:-}" in
  ui)
    timeout 60 "${AXE[@]}" describe-ui --udid "$UDID" 2>/dev/null | python3 "$HERE/tree.py"
    ;;
  tap)   timeout 40 "${AXE[@]}" tap -x "$2" -y "$3" --udid "$UDID" 2>&1 | tail -1 ;;
  swipe)
    timeout 40 "${AXE[@]}" swipe --start-x "$2" --start-y "$3" --end-x "$4" --end-y "$5" \
      --duration "${6:-0.4}" --udid "$UDID" 2>&1 | tail -1
    ;;
  type)  timeout 60 "${AXE[@]}" type "$2" --udid "$UDID" 2>&1 | tail -1 ;;
  url)   timeout 30 xcrun simctl openurl "$UDID" "$2" 2>&1 | tail -1 ;;
  shot)
    mkdir -p "$OUT"
    png="$OUT/$2.png"
    rm -f "$png"
    # simctl writes the PNG and then intermittently hangs instead of exiting,
    # so the file appearing on disk is the success signal, not the exit code.
    for _ in 1 2 3; do
      timeout 45 xcrun simctl io "$UDID" screenshot "$png" >/dev/null 2>&1
      for _ in $(seq 8); do [ -s "$png" ] && break; sleep 1; done
      [ -s "$png" ] && break
    done
    [ -s "$png" ] && echo "$png" || { echo "capture failed: $png" >&2; exit 1; }
    ;;
  chrome)
    xcrun simctl ui "$UDID" appearance dark
    xcrun simctl status_bar "$UDID" override \
      --time "9:41" --batteryState charged --batteryLevel 100 \
      --cellularMode active --cellularBars 4 --wifiMode active --wifiBars 3 --dataNetwork wifi
    echo "status bar pinned to 9:41, dark appearance"
    ;;
  *)
    sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
    ;;
esac
