# Store screenshots & app previews

Everything needed to regenerate the App Store and Play Store listing art. The
marketing layer is code, so re-shooting after a UI change is a capture pass plus
one command — not an afternoon in a design tool.

```
captures/<platform>/<screen>.png   raw device captures (the only manual step)
shots.mjs                          copy + art direction, one entry per artboard
frame.mjs                          the compositor (HTML → PNG via headless Chrome)
build.mjs                          CLI: node scripts/appstore/build.mjs ios|android
feature.mjs                        Play feature graphic (1024×500)
choreo.sh                          scripted walkthrough for the app preview video
simctl.sh / adb.sh                 drive a booted simulator / emulator
out/<platform>/                    finished artboards — upload these
```

Coordinate systems differ between the two drivers and it is the easiest way to
waste an hour: **`simctl.sh` takes points** (440×956 on a 6.9" iPhone) while
**`adb.sh` takes pixels** (1280×2856 on a Pixel 10 Pro).

## 1. Stand up a demo server

Never shoot against a real journal. `docs/demo/tradermemos-demo-trades.json` is
the curated book (172 trades over 13 months, +$24,990.52, 60.1% win rate) built
for exactly this.

```sh
go build -o /tmp/tm-api ./api/cmd/server
TM_HTTP_PORT=8123 TM_DB_PATH=/tmp/demo.db TM_JWT_SECRET=demo TM_ALLOW_INSECURE_JWT=true /tmp/tm-api &

curl -sX POST localhost:8123/api/v1/setup -H 'Content-Type: application/json' \
  -d '{"email":"demo@tradermemos.app","password":"demo-screenshots-2026",
       "account":{"name":"Main","base_currency":"USD","starting_balance":25000}}'

curl -sX POST localhost:8123/api/v1/imports/commit -H "Authorization: Bearer $TOKEN" \
  -F "file=@docs/demo/tradermemos-demo-trades.json" -F "account_id=$ACCOUNT"
```

**Backdate the opening deposit before shooting.** `ensureOpeningDeposit` stamps
the account's starting balance as an "Opening balance" cash transaction dated
*now*, so the equity curve runs from zero and then jumps $25k straight up on the
last point. Move it in front of the first trade:

```sh
sqlite3 /tmp/demo.db \
  "update cash_transactions set occurred_at='2025-08-01 14:30:00 +0000 UTC' where note='Opening balance';"
```

## 2. Build a Release app, not the dev client

The dev client paints a floating dev-tools gear over every screen and its
in-app toggle is fiddly to hit. A release build has no such chrome and is what
users actually see.

```sh
cd mobile && npx expo run:ios --device "iPhone 17 Pro Max" --configuration Release
cd mobile/android && ./gradlew assembleRelease   # then: adb install -r …/app-release.apk
```

## 3. Capture

```sh
scripts/appstore/simctl.sh chrome          # 9:41, full bars, dark appearance
scripts/appstore/simctl.sh ui              # element tree with tap points
scripts/appstore/simctl.sh tap 172 913     # POINTS (440×956), never pixels
scripts/appstore/simctl.sh shot home       # → captures/ios/home.png
```

Screens worth knowing:

| Capture | How to get there | Watch for |
|---|---|---|
| `home` | Home tab, tap **ALL** on the equity curve | 30D is a flat line plus a spike — the demo book's last closed trade is months before "today" |
| `trades` | Trades tab, scroll one screen | Unscrolled, the list leads with four `$0.00` open positions |
| `trade-detail` | Open a trade, scroll to **Coach** | Skip the chart — see Known issues |
| `calendar` | Calendar tab, step back to a month with closed trades | The current month is empty |
| `reports` | `tradermemos://reports`, **Detailed** tab | — |
| `sign-in` | Settings → Sign out | Set the server field to `http://localhost:8123` so it reads as a real host and still shows "Reachable" |

## 4. Compose

```sh
node scripts/appstore/build.mjs ios       # 1320×2868  → out/ios
node scripts/appstore/build.mjs android   # 1080×1920  → out/android
node scripts/appstore/feature.mjs         # 1024×500   → out/android/feature-graphic.png
```

A missing capture renders a striped placeholder instead of failing, so the
layout can be reviewed before every screen has been shot. `out/` is wiped on
each run, so renaming a slug can't leave a stale artboard behind to be uploaded.

Canvas sizes: **1320×2868** is the App Store 6.9" size and the only iPhone size
Apple requires — it downscales that for every smaller device. **1080×1920** is
9:16 for Play, which caps phone screenshots at 2:1.

## 5. App preview video

Apple wants 15–30s of real app footage, H.264, at an accepted size (886×1920
for 6.9" — within a pixel of the device's own aspect, so no cropping).

```sh
xcrun simctl io <udid> recordVideo --codec h264 --force raw.mov &
scripts/appstore/choreo.sh          # drive the app while it records
kill -INT %1

ffmpeg -ss 2 -to 31 -i raw.mov \
  -vf "scale=886:1920:flags=lanczos,fps=30,format=yuv420p" \
  -c:v libx264 -profile:v high -preset slow -crf 18 -movflags +faststart -an \
  out/ios/app-preview-6.9.mp4
```

## Gotchas that cost real time

- **`axe` speaks points, `simctl` speaks pixels.** On a 6.9" iPhone that is
  440×956 vs 1320×2868. A pixel coordinate taps off-screen and `axe` still
  prints "completed successfully".
- **Never export `DEVELOPER_DIR`.** `axe` needs it pointed at the xcode-shim,
  but `xcrun simctl` silently stops writing screenshots under it. Scope it to
  the `axe` invocation (`simctl.sh` does).
- **`simctl io screenshot` writes the file and then hangs** instead of exiting.
  Treat the file appearing on disk as the success signal, not the exit code.
- **`chrome-headless-shell` does the same** — hence `--virtual-time-budget` and
  the existence check in `frame.mjs`.
- **`expo run:android` cannot resolve the emulator** in a non-interactive shell
  ("Could not find device with name: emulator-5554", regardless of `--device`).
  Use Gradle directly and install with `adb install -r`.
- **On Android, type into the top field and `KEYCODE_TAB` down.** Tapping a
  lower input lands on the soft keyboard instead, and the text silently appends
  to whatever field still has focus.
- **`adb reverse tcp:8123 tcp:8123`** lets the emulator reach the demo API at
  `http://localhost:8123`, so the sign-in capture reads like a real host instead
  of exposing `10.0.2.2`.
- **Toggling a switch twice looks like it never toggled.** Re-read the tree
  between taps rather than firing a second one at a slightly different x.

## Known issues visible in captures

Both are in the app/demo data, not the capture pipeline:

- **MAE/MFE are wrong on some trades.** An AVGO trade with $7,953 notional that
  lost $154 reports MFE $13,820.95 and post-exit MFE $13,252.80.
- **The trade chart plots the wrong price range.** The same trade filled at
  $144.60 → $141.80 while its chart axis runs $361–$392.
- **Duplicate axis labels on the equity curve** ("Jul 28, Jul 28", "Jul 24, Jul 24")
  when the window is short.
- **The Reports large title overlaps its segmented tabs** when reached by deep
  link, and does not settle. The app preview ends on the calendar to avoid it.
