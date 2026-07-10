# Web UI Stabilization — Wave 1 (Design)

**Date:** 2026-07-10
**Branch:** `feature/web-ui-redesign`
**Source:** Live UI/UX audit of the Signal Terminal redesign (screenshots `audit-*.png` in repo root).

## Goal

Make the redesigned web app trustworthy for a daily trading-review session: no crashes, no surprise logouts, no lost journal text, no misleading chart/date rendering. Larger UX moves (command palette, metrics redesign, dashboard bento restructure, toolbox IA, drawer conversion, import UX) are **Wave 2** and out of scope here.

## Scope — four fixes

> **Amendment (2026-07-10):** the original item 3 ("nav tooltips render under the Toolbox rail") was withdrawn after visual verification: tooltips paint correctly above the toolbox (`nav` is `z-[2]` vs the content frame's `z-[1]`). The earlier evidence was a hit-testing artifact of `pointer-events-none` tooltips. The two-identical-rails IA concern remains a Wave 2 item.

### 1. Reports screen crash

`web/src/app/screens/ReportsView.tsx` uses `<StatCard>` (lines 110–158) without importing it, so `/reports` throws `ReferenceError: StatCard is not defined` and the whole app is replaced by TanStack Router's raw fallback.

- Add the missing `StatCard` import.
- Add a `defaultErrorComponent` (via `createRouter` options) styled with Signal tokens: it renders **inside the app shell region**, shows the error message in mono, and offers a "Reload" button. A screen-level crash must never take down the shell again.
- Regression test: render `ReportsView` with mock summary data (the existing `ReportsView.test.tsx` evidently never renders the metrics grid — extend it so this class of bug fails CI).

### 2. Session continuity (auth refresh + journal draft autosave)

The API mints 15-min access / 30-day refresh tokens and exposes `POST /auth/refresh`, but `web/src/lib/api/client.ts` stores only `tm_token`; any 401 hard-logs the user out.

- Persist the refresh token as `tm_refresh` alongside the access token wherever tokens are set (login, register, dev sign-in).
- In the client request path: on a 401 for a non-`/auth/*` route, perform a **single-flight** refresh (concurrent 401s await the same refresh promise), retry the original request once with the new access token. If refresh fails or the retry 401s again → existing logout behavior.
- Never attempt refresh recursively from the refresh call itself.
- Journal draft autosave (`TradeDetailView`): debounce-save the journal form (notes, setup, risk, emotional state, confidence, quality, MAE/MFE) to `localStorage` keyed `tm_draft_trade_<id>`; restore on mount if present (and newer than server data load); clear on successful save. No server API changes.
- Tests: client unit tests for refresh-retry, single-flight, and refresh-failure logout; TradeDetail test for draft restore/clear.

### 3. One locale, one date format

Tables hardcode `en-US` (`7/10/2026`) in seven files while native `datetime-local` inputs follow the OS locale (`10/07/2026`).

- New module `web/src/lib/locale.ts` exporting `LOCALE` derived from `navigator.language` (fallback `en-US`).
- Replace all seven `const LOCALE = "en-US"` copies and the two inline `toLocaleString("en-US", …)` calls in `SettingsView.tsx` with the shared constant, so formatted output agrees with what the native inputs display.
- Existing unit tests that assert `en-US` strings pin `navigator.language` in test setup so they stay deterministic.

### 4. Equity chart axes (DashboardView)

- **Y-axis:** compact currency ticks — drop cents; use `$10.1k`-style compact notation (`Intl.NumberFormat` `notation: "compact"`) so labels fit the 64px gutter without clipping.
- **X-axis:** humanized day ticks (`Jul 9`) instead of raw ISO slices, and dedupe ticks so a day appears at most once (compute unique-day `ticks` from the series rather than relying on `minTickGap`).
- Apply the same treatment to the equity chart in `ReportsView` if it shares the pattern (verify during implementation).

## Error handling

- Refresh race: single-flight promise guard (item 2) is the only concurrency-sensitive piece.
- Draft restore must not clobber freshly saved server data: store a timestamp with the draft and only offer/restore when the draft is newer than the loaded journal payload.

## Testing

- `make test-web` (vitest) covers items 1, 2, 3.
- `make e2e` smoke must still pass; add a smoke step that visits `/reports` (it would have caught the crash).
- Manual verify per `/verify`: drive the live app — visit Reports, let a token expire (or shorten TTL locally) and confirm silent refresh, check chart axes and date rendering.

## Out of scope (Wave 2 backlog)

Command palette (⌘K), stat-strip metric semantics (mixed denominators, AVG W 0%), Trade Detail analytics (R-multiple, tags UI, entry/exit chart), dashboard bento restructure (de-duplicating the trade log), New Trade/Setup modal→drawer conversion, toolbox rail IA, Import drop-zone (covered by the Smart Import spec), font self-hosting, Geist dependency removal.
