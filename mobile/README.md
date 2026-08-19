# TraderMemos Mobile

Expo SDK 57 client for a self-hosted [TraderMemos](../README.md) server — one codebase,
one identical codepath on **iOS and Android**.

Built on **PanelUI** (`panelui-native`) styled with Tailwind v4 through **Uniwind** —
JS-drawn components against shadcn-style design tokens in `src/global.css`, so both
platforms render the same UI. (`@expo/ui` remains installed only as PanelUI's optional
peer for `<Button native glass>` chrome; it is never imported directly.)

## Requirements

- Node 25.6.1 (pinned in `.mise.toml`), pnpm 11 (via `../scripts/ensure-pnpm.sh`)
- iOS: Xcode with an iOS simulator runtime
- Android: JDK 17 + the Android SDK / an emulator or device (`make doctor-android` verifies)
- Either way the app runs as a **development build**, not Expo Go

## Getting started

```bash
pnpm install
npx expo run:ios       # first time: builds + installs the dev client on the simulator
npx expo run:android   # same for an Android emulator/device
pnpm start             # every day after: starts Metro; open the TraderMemos app
```

Rebuild (`npx expo run:ios` / `run:android`) only when native dependencies or `app.json`
change — JS-only changes hot-reload through Metro like always.

> **Why not Expo Go?** The Expo Go 57.0.5 binary embeds native worklets 0.10.0 while SDK 57
> pins the JS at 0.10.1; the mismatch segfaults Expo Go the moment it loads this project.
> The dev build compiles native modules from our own package.json, so versions always match —
> and it unblocks native-code libraries (charts) that Expo Go can never run.

`pnpm-workspace.yaml` sets `nodeLinker: hoisted`: Metro and Expo autolinking walk a flat
`node_modules`, which pnpm's default symlinked store does not provide.

The app has no bundled server address. On first launch you supply your own instance URL
(e.g. `http://192.168.1.10:8080`) along with your credentials — the same "Set Server at login"
model the web app uses. The host is probed at `/healthz` before the login attempt so an
unreachable server reports as such rather than as bad credentials.

Tokens are stored in **SecureStore** (Keychain / Keystore), never AsyncStorage. A 401 triggers
one refresh against `POST /api/v1/auth/refresh` and a replay; a second 401 returns you to login.

## Checks

```bash
pnpm run check     # tsc --noEmit
pnpm run lint      # eslint
pnpm run doctor    # expo-doctor
```

## Upgrading

Use `pnpm exec expo install --check`, never `pnpm update --latest` — runtime packages are
pinned by the SDK, and `outdated` reports versions outside SDK 57's compatibility window.

## Layout

```
src/
  api/         client, session (SecureStore), TanStack Query hooks, wire types
  app/         Expo Router routes only — never co-locate components here
    (tabs)/
      (dashboard)/   P&L summary + reports
      (calendar)/    monthly P&L calendar
      (trades)/      list + detail
      (settings)/    settings lists (SettingsForm)
    login.tsx        server URL + credentials
  components/  shared views (stat-card, trade-row, …)
  global.css   design tokens (Tailwind v4 variables, mirrored from the web theme)
  i18n/        Lingui catalogs (en, ja, ko, zh-HK)
  lib/         formatting helpers
```

## iOS Shortcuts / share sheet (iOS only)

The new-trade form can be opened with files already scanned into it. A URL scheme carries
text only, so the file travels through a drop folder instead:

- **`Documents/Import`** — created at launch and exposed in Files as *On My iPhone →
  TraderMemos → Import* (`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace`).
- **`Documents/Inbox`** — where iOS copies documents handed over by another app's share
  sheet (`CFBundleDocumentTypes` claims images and CSV/JSON as *Viewer*).

Both are drained by `tradermemos://new-trade?import=1`: images go through `POST /ocr/parse`,
CSV/JSON parses on-device, and the merged extract becomes the form's blocks
(`src/lib/trade-import.ts`). Consumed files are deleted; a drop that can't be imported yet
(no vision endpoint, signed out) stays put for the next run.

A shortcut that files a broker screenshot is then:

```
Take Screenshot                    ← run it from Back Tap / Action Button, not
Save File → TraderMemos/Import        from inside the Shortcuts app
   (turn "Ask Where To Save" off)
Open URL → tradermemos://new-trade?import=1
```

Sharing a screenshot or a CSV to TraderMemos from Photos/Files reaches the same place —
`ImportLinkGate` in `app/_layout.tsx` stages the incoming `file://` URL and opens the form.

## Native builds

`ios/` and `android/` are **generated** by Continuous Native Generation and are gitignored:

```bash
npx expo prebuild --clean
npx expo run:ios       # or: npx expo run:android / make run-android
```

UIScene adoption for the iOS 27 SDK (expo/expo#46663) is applied by the
`plugins/with-ios-scene-lifecycle.js` config plugin, so a clean prebuild no longer loses it —
locally or on an EAS worker.

## Cloud builds (EAS)

`eas.json` defines four profiles — `development` (simulator dev client / Android APK),
`preview` (internal distribution), `production` (iOS store build / Android app-bundle)
and `production-apk` (release-signed sideloadable APK). From the repo root:

```bash
make eas-build-dev       # simulator dev client, no local toolchain needed
make eas-build-preview   # ad-hoc build for registered devices
make eas-build-ios       # App Store build
make eas-submit-ios      # push the latest store build to App Store Connect
make eas-build-android   # release-signed APK (production-apk profile)
```

CI does the same through `.github/workflows/mobile-eas.yml` — manually via
*workflow_dispatch*, or automatically when a release ships: the iOS build submits to
TestFlight behind the `app-store` approval gate, and the Android build's APK is attached
to the GitHub Release page (`TraderMemos-<version>.apk`), which is the Android
distribution channel — there is no Play Store presence. The marketing version comes from
`app.json` (release-please bumps it); build numbers are assigned by EAS
(`cli.appVersionSource: "remote"`). One-time account setup (including the EAS-managed
Android keystore) is in [`docs/release.md`](../docs/release.md#mobile-releases).
