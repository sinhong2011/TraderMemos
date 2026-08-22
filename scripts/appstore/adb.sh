#!/bin/bash
# Drive a running Android emulator/device to capture store screenshots.
#
#   scripts/appstore/adb.sh ui              # dump the view hierarchy with tap points
#   scripts/appstore/adb.sh tap <x> <y>     # tap (PIXELS — unlike the iOS helper)
#   scripts/appstore/adb.sh swipe <x1> <y1> <x2> <y2> [ms]
#   scripts/appstore/adb.sh text "string"
#   scripts/appstore/adb.sh shot <name>     # → captures/android/<name>.png
#   scripts/appstore/adb.sh url <deep link>
#   scripts/appstore/adb.sh chrome          # demo status bar, dark theme
#
# Note the coordinate difference from simctl.sh: `adb shell input` works in
# device pixels, so the numbers here match what you measure on a screenshot.
#
# The proxy strip matters — this machine exports HTTP(S)_PROXY for xray, and an
# adb server that inherits it answers "No route to host" for every device.

set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB=(env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy \
     "$ANDROID_HOME/platform-tools/adb")
[ -n "${SERIAL:-}" ] && ADB+=(-s "$SERIAL")
OUT="$HERE/captures/android"
PKG=com.tradermemos.app

case "${1:-}" in
  ui)
    "${ADB[@]}" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
    "${ADB[@]}" shell cat /sdcard/ui.xml 2>/dev/null | python3 -c '
import re, sys
xml = sys.stdin.read()
for node in re.finditer(r"<node[^>]*>", xml):
    s = node.group(0)
    attr = lambda k: (re.search(k + r'"'"'="([^"]*)"'"'"', s) or [None, ""])[1]
    text, desc = attr("text"), attr("content-desc")
    label = text or desc
    if not label:
        continue
    b = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", s)
    if not b:
        continue
    x1, y1, x2, y2 = map(int, b.groups())
    print(f"c=({(x1+x2)//2},{(y1+y2)//2}) [{x1},{y1} {x2-x1}x{y2-y1}]  {label[:60]}")
'
    ;;
  tap)   "${ADB[@]}" shell input tap "$2" "$3" ;;
  key)   "${ADB[@]}" shell input keyevent "$2" ;;
  # Clear a focused field: jump to the end and backspace over it. There is no
  # select-all that works reliably across RN text inputs.
  clear) "${ADB[@]}" shell "input keyevent 123; for i in \$(seq ${2:-60}); do input keyevent 67; done" ;;
  swipe) "${ADB[@]}" shell input swipe "$2" "$3" "$4" "$5" "${6:-400}" ;;
  text)  "${ADB[@]}" shell input text "${2// /%s}" ;;
  url)   "${ADB[@]}" shell am start -a android.intent.action.VIEW -d "$2" "$PKG" >/dev/null ;;
  shot)
    mkdir -p "$OUT"
    "${ADB[@]}" exec-out screencap -p > "$OUT/$2.png"
    [ -s "$OUT/$2.png" ] && echo "$OUT/$2.png" || { echo "capture failed" >&2; exit 1; }
    ;;
  chrome)
    "${ADB[@]}" shell settings put secure ui_night_mode 2 >/dev/null
    "${ADB[@]}" shell cmd uimode night yes >/dev/null
    # demo mode paints a clean status bar: fixed clock, full bars, no notifications
    "${ADB[@]}" shell settings put global sysui_demo_allowed 1
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941 >/dev/null
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
    # Wi-Fi only: a "3G" chip next to a full signal bar reads as a stale mock.
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command network \
      -e wifi show -e level 4 -e fully true >/dev/null
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command network -e mobile hide >/dev/null
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command status \
      -e volume hide -e bluetooth hide -e location hide -e alarm hide -e sync hide -e tty hide >/dev/null
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null
    echo "demo status bar on, dark theme"
    ;;
  chrome-off)
    "${ADB[@]}" shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null
    echo "demo status bar off"
    ;;
  *) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
