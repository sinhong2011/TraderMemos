# Agent rules

## UI features ship only after a full end-to-end run

**Any new or changed UI must be driven end to end — real taps, on a real device or
emulator — before the work is called done or a PR is opened. Every case below has to
pass. A feature with an unexercised case is unfinished, not "probably fine".**

This is not a style preference. Two bugs in one session got through `tsc`, `eslint`, a
screenshot and an accessibility-tree read, and were caught only by a finger on a screen:

- A month/year picker whose year face rendered nothing, because a Reanimated `entering`
  animation that starts inside a bottom sheet's portal never runs and leaves the view at
  its `initialValues` opacity of `0`.
- An `Apply` button that reverted its own result, because closing the sheet re-entered a
  handler holding a stale closure over the state set one line earlier.

Neither is visible in code review. Both are obvious in two taps.

### The cases that must pass

Run each and keep the screenshot:

1. **Happy path** — the thing does what it says.
2. **The inverse** — a filter that *excludes*, a toggle turned off, an empty result. A
   change that leaves the screen looking identical proves nothing.
3. **Read-back** — reopen the control and confirm it reflects the applied state, in the
   summary, label, or checkmark the user reads it from.
4. **Re-entry** — reopen the surface and confirm it starts from what is in force, not
   from what a previous visit was abandoned on.
5. **Cancel** — dismiss without committing; the app must land back where it started.
6. **Reset** — the clear/reset path returns to the baseline.
7. **Every state transition the feature has.** Both directions of a toggle, both
   directions of a transition. Arriving somewhere is not proof you can get back.

### Screenshot after every step

The accessibility tree is not evidence. A view at `opacity: 0` is fully present in it,
correctly labelled, and completely invisible — which is exactly how the empty year face
read as working. Look at the pixels.

### Where to run it

**Android emulator** (`Pixel_10_Pro` AVD) is the reliable target: `adb shell input tap`
delivers real touches, and screenshot pixels map 1:1 to tap coordinates.

```
adb -s emulator-5554 shell input tap <x> <y>
adb -s emulator-5554 exec-out screencap -p > shot.png
```

Always `-s emulator-5554`; several devices are usually attached.

**The iOS simulator on this machine accepts no synthetic input.** This Xcode install ships
no `Simulator.app`, so SimulatorKit HID injection has nothing to inject into: `axe` and
`idb` both report success and deliver nothing, `axe button home` included. Screenshots via
`simctl io` still work. Prefix `DEVELOPER_DIR` only onto `axe` itself — exporting it breaks
every `xcrun` in the same shell.

### Point the app at a real API first

Check Settings → Server before trusting a single result. An app pointed at Metro's port,
or at a dead server, still renders a full screen from the **MMKV query cache** — and only
the queries whose cache key is new go to the network and fail. A screen that loads is not
proof the server is reachable.

When the dev server's data is thin or its state is unknown, stand up a throwaway one from
the working tree rather than testing against a moving target:

```
TM_HTTP_PORT=8091 TM_DB_PATH=<tmp>/qa.db TM_JWT_SECRET=$(openssl rand -hex 32) go run ./cmd/server
POST /api/v1/setup      # first user
POST /api/v1/accounts   # an account
POST /api/v1/executions # buy + sell pairs, dated to straddle whatever is being tested
```

Seed data that makes the assertion sharp: to test a date filter, two trades on different
sides of the boundary, so the right one drops out.

### Reporting

State plainly what was tapped and what was not. "Renders correctly" is not "works" —
if a path could not be exercised, name it as unverified rather than letting a green
`check`/`lint` imply coverage it does not have.

## Cursor Cloud specific instructions

The image already has Go 1.27.0, Node 24.18.0, pnpm 12.7.0, `air`, and `sqlc` on `PATH`. Do not use the image's older `/usr/bin/go` (1.22) or `/exec-daemon/node` (22). Mobile is pinned to Node 25.6.1 — prepend it before any `mobile/` command:

```
export PATH="/usr/local/lib/node-25/bin:$PATH"
```

SQLite is the dev database. `api/.env` is copied from `api/.env.example` on install (insecure JWT allowed for local dev only). Boot starts the API with `air` on `:8080` and the web app with `pnpm run dev -- --host 0.0.0.0 --port 5173`. Vite proxies `/api` to the API. First visit is the setup wizard.

Validate from the repo root with `make check` and `make test`. Marketing, from `marketing/`: `pnpm run lint`, `pnpm run types:check`, `pnpm run build`. This image has no Android SDK or iOS simulator, so mobile native builds are out of scope; `pnpm run check` and `pnpm run lint` in `mobile/` are the cloud checks.
