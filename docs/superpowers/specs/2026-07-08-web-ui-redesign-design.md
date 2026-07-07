# Web UI Redesign — Stonk Journal Visual Language

**Date:** 2026-07-08
**Status:** Approved
**Scope:** `web/` only. No backend changes.

## Goal

Restyle the entire TraderMemos web app to match the visual language of four
reference screenshots (Stonk Journal v2 dark UI): layered-slate dark theme,
branded sidebar with quick actions, header account-P&L block, dashboard with
equity band + stats strip + dense trades table, calendar with weekly P&L
column, and right-side drawers for logging trades and creating setups.

TraderMemos branding and only real features are kept. Explicitly dropped from
the reference: AI Coach, PRO badges, Migrate from V1, Support this platform,
New Note, theme toggle (app stays dark-only), the secondary icon "toolbox"
rail, trade templates, "Save copies to", Journal/Dividends drawer tabs, and
"Check compliance".

## Approach

Restyle in place (approach A). Keep the existing architecture — TanStack
Router routes, `lib/api` layer, hooks, TanStack Table, zustand, vitest +
Playwright suites — and rework the presentation layer: tokens, shell,
primitives, then each screen. Existing tests keep passing (assertions updated
where markup changes).

## 1. Design system

Extend the CSS-variable tokens in `web/src/styles.css`:

- **Surfaces:** move from near-black to layered navy-slate. Content base
  ≈ `#171c26`, sidebar/header ≈ `#12161f`, raised cards/cells ≈ `#1e2430`,
  plus hover steps. Borders lighten accordingly.
- **Semantic:** keep `--color-pos` (green), `--color-neg` (red), blue accent.
  Add amber (breakeven/wash, New Setup accent), tinted fills for calendar
  cells (red/green at ~35% alpha), and pill backgrounds (WIN green tint,
  LOSS red tint, LONG/SHORT, blue hold-time chips).

New primitives in `web/src/components/`:

| Component | Purpose |
|---|---|
| `Pill` | WIN/LOSS/OPEN status, LONG/SHORT, market chips, hold-time chips |
| `StatBar` | label + value + thin colored progress bar (dashboard stats strip) |
| `Drawer` | right-side slide-over on Base UI Dialog, ~40–45% width, dark scrim |
| `SegmentedControl` | 30D/90D/ALL range, LONG/SHORT side toggle |

## 2. App shell

Rework `AppShell` + `AppNav`:

- **Sidebar (~260px):** logo + "TraderMemos" wordmark; account switcher as a
  rounded select with green status dot + edit button; nav (Dashboard,
  Stats→Reports, Calendar, Trades, Playbook, Import, Settings, Help→docs
  link) with icon + label, active item accent tint + left indicator bar;
  divider; quick actions **New Trade** (blue) and **New Setup** (amber) that
  open the drawers from any route.
- **Header (~56px):** sidebar-collapse toggle; account P&L block — large
  colored net P&L figure with "Cash" and "Active" sub-stats (from
  `analytics/summary` + cash API); right: Search-and-Filter input, existing
  date-range picker, sign-out.

## 3. Screens

**Dashboard:** top band = compact equity-curve chart (Recharts line with
red/green drawdown-region shading) + 30D/90D/ALL segmented control; beside it
the stats strip: WINS/LOSSES StatBars with counts + %, OPEN/WASH(breakeven)
column, AVG W / AVG L column with % bars, large PnL figure with colored
period-return badge. Below: full-width trades table — DATE, SYMBOL (accent
link), STATUS pill, DIR arrow, MARKET (icon + STK/OPT chip from
`instrument_type`), QTY, ENTRY, EXIT, ENT TOT, EXT TOT, HOLD (blue duration
chip from `time_in_trade_secs`), RETURN ($, colored), RETURN %, "…" row menu
(view/edit/delete). Footer: "All N trades loaded". Row click → trade detail.

**Calendar:** month grid of rounded raised cells; traded days get red/green
tinted fill with net P&L + `2W1L` record line; today gets a blue dot; ‹ › +
"Today" nav. Header stats row: Trades, Win rate, Record (`2W·2L` colored),
Profit factor, Month P&L with %. An 8th **WEEK** column shows per-week P&L +
record, computed client-side (extend `lib/calendar.ts`). Day click keeps
current drill-in behavior.

**Remaining screens:** Trades view = the dashboard table full-page with the
restyled filter bar; Trade Detail, Reports, Playbook, Import, Settings get
Panel/typography/pill restyling only (no layout redesign); Login gets the new
palette + centered card with logo.

## 4. Drawers

**New Trade** (from sidebar quick action): info banner; MARKET select
(instrument types the importer already produces), SYMBOL, LONG/SHORT toggle;
executions editor — rows of BUY/SELL pill, datetime, qty, price, fee, with
`+` add / `×` remove. Save posts each row to existing `POST /executions`
sequentially; on partial failure, report which rows failed and keep them in
the form; then invalidate trades/analytics queries (backend engine groups
executions into trades). Buttons: Save / Cancel. Journal notes are added on
the trade detail page after creation.

**New Setup:** NAME + DESCRIPTION/NOTES textarea with info banner; Save →
existing `POST /setups`, invalidates Playbook query. Shares the Drawer shell.

## 5. Data flow & state

No new endpoints. Header P&L = `analytics/summary` (current filter scope) +
cash balance, via existing hooks. Drawer open state lives in a small zustand
slice so quick actions work from any route.

## 6. Errors & empty states

Drawers validate with zod before submit (symbol required, qty/price > 0),
inline field errors; API failures via existing Toast. Screens keep current
loading skeletons/EmptyStates, restyled.

## 7. Testing

- Existing vitest suites keep passing (assertions updated for new markup).
- New unit tests: calendar week-summary math, Pill/StatBar rendering, drawer
  submit logic with mocked API (including partial-failure handling).
- Playwright smoke extended: open New Trade drawer → log a trade → trade
  appears in the table.
