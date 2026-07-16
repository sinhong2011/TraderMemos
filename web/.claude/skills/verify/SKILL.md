---
name: verify
description: How to run and drive the TraderMemos web app for runtime verification of UI changes.
---

# Verifying web/ changes

## Handles

- Vite dev server usually already running at `http://localhost:5173` (check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`). Go API listens on `:8080`; Vite proxies `/api`.
- If not running: `cd web && bun run dev` (background; runs `vp dev`).
- Validate with `vp check` and `vp test` after web changes.
- The browser session at localhost:5173 is typically already authenticated (token in localStorage). If you land on the login screen, the dev DB may also be empty — see the `e2e-needs-seeded-trades` memory: seed via `POST /executions` + regroup.
- Drive with the Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`). Screenshots/snapshots land in `.playwright-mcp/` at the repo root.

## Flows worth driving

- `/calendar` — MonthPicker (trigger labeled "<Month Year>, choose month"), day cells, week summaries.
- Header "Date range" button — DateRangePanel presets + custom two-click range (first click holds a pending start; footer shows "Select end date").
- "New Note" nav button — drawer with SignalDatePicker ("Date" field). "New Trade" uses SignalDateTimePicker for fill timestamps.

## Gotchas

- Initial page load logs a burst of 401s before the auth token refresh kicks in; the page recovers. Not a regression signal by itself.
- Vite HMR remounts components, resetting popover/filter state mid-session — reopen the popover after an edit.
- Filter state (date range, account) persists in the session; restore "All time" when done to leave the app as found.
