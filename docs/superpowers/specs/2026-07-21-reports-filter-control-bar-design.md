# Reports Filter & Control Bar

**Date:** 2026-07-21
**Status:** Approved (design)
**Scope:** Sub-project 5 (final) of the staged Reports upgrade. Built in two stages under this one spec.

## Context

The Reports page (`web/src/app/screens/ReportsView.tsx`) is now organized into four tabs (SP4) with a KPI grid, breakdown cards, execution-grade card, and a stock P&L heatmap. This sub-project adds a control bar — the last Tradervue-inspired gap — with two display-mode toggles and two data filters. Prior sub-projects SP1/SP2/SP4 are done on branch `reports-execution-grade`; SP5 stacks on top. SP3 was skipped.

Feasibility established during brainstorming:
- `Summary` and every `BreakGroup.summary` already carry `gross_profit`/`gross_loss`/`net_pnl`/`total_fees` → **Gross/Net is a frontend display transform**.
- Accounts carry `starting_balance` (present on the frontend `Account` type) → **$/% is a frontend transform** (% = value ÷ starting balance).
- The analytics endpoints are server-aggregated over `loadClosedTrades`, whose `store.Trade` rows carry `Direction` and `TimeInTradeSecs` → **Side/Duration need a small backend filter extension** (Go-side, no new SQL).
- The analytics API client serializes the whole filter object via `qs(f)`, so new filter fields flow through with no per-endpoint change.

## Goals

1. A control bar (below the tab bar, persistent across tabs) with: `Net | Gross`, `$ | %`, `Side` (All/Long/Short), `Duration` (All/Scalp/Day/Swing).
2. Side/Duration filter the analytics data (backend).
3. Net/Gross and $/% re-express P&L **page-wide** across every card and chart (frontend).
4. All four controls persist in the URL (extending the existing `?tab=` search) so a Reports view is shareable/deep-linkable.

## Non-Goals

- No new persisted fields. `%` uses the starting-balance basis, not live equity.
- Filters affect only Reports analytics, not the trade log or other screens.
- No changes to the global filter store (`useFilters`); Side/Duration/modes are Reports-local view state.

## Design

### URL state (both stages)

Extend `validateReportsSearch` (`web/src/routes/reports.tsx`) to validate five params, all optional with defaults:
`tab` (existing), `side` (`all|long|short`, default `all`), `dur` (`all|scalp|day|swing`, default `all`), `pnl` (`net|gross`, default `net`), `unit` (`abs|pct`, default `abs`). Unknown values coerce to their default. The route reads them via `Route.useSearch()` and updates via `useNavigate` (functional `search` updater), passing values + change handlers to `ReportsView`.

---

### Stage 1 — Side/Duration filters (backend + controls)

**Backend** (`api/`):
- Extend `Filters` (`api/internal/api/filters.go`) with `Side string` and `Duration string`.
- `parseFilters` reads `side` (`""|long|short`) and `duration` (`""|scalp|day|swing`), validating the enum (invalid → 400, matching the existing `status` validation style).
- Add a `durationBucket(t store.Trade) string` helper and a `Filters.matchTrade(t store.Trade) bool` that layers Side/Duration onto the existing symbol/date checks. Buckets (ET calendar day via the existing session clock):
  - **swing** — `ClosedAt` is on a later ET calendar day than `OpenedAt` (held overnight).
  - **scalp** — not swing and `TimeInTradeSecs != nil && *TimeInTradeSecs < 600` (< 10 min; cutoff is a named const `scalpMaxSecs = 600`).
  - **day** — not swing and not scalp.
  - Side: `long`/`short` compares `t.Direction`.
- `loadClosedTrades` (`api/internal/api/dto.go`) applies the Side/Duration checks in its existing filter loop (extend the `matchClosed` call to also run `matchTrade`, or fold both into one predicate). All analytics endpoints inherit it via `loadClosedTrades`.
- Tests: `filters` unit tests for `durationBucket` (overnight→swing, 5-min→scalp, 2-hr same-day→day, nil duration→day) and Side matching; a handler test that `?by=symbol&side=long&duration=scalp` narrows the result set.

**Frontend** (Stage 1 UI):
- Add `side?`/`duration?` to the frontend `Filters` type (`web/src/lib/api/…`) so `qs()` serializes them.
- The route merges them into the analytics filter object: `const analyticsFilters = { ...useFilterParams(), side: side === "all" ? undefined : side, duration: dur === "all" ? undefined : dur };` passed to every `useSummary`/`useRSummary`/`useEquityCurve`/`useBreakdown`/`useDailyPnl` call (replacing the current `filters`).
- New `ReportsControlBar` component (`web/src/components/ReportsControlBar.tsx`) rendering the Side and Duration selectors (reuse `SegmentedControl` or a compact dropdown) — Stage 1 renders only these two; Stage 2 adds the mode toggles to the same bar. Placed in `ReportsView` between the `TabsList` and the `TabsContent` panels.
- Tests: `ReportsControlBar` renders options and calls change handlers; route test extends `validateReportsSearch` cases for `side`/`dur`.

### Stage 2 — Net/Gross + $/% display modes (frontend, page-wide)

**`ReportsDisplayContext`** (`web/src/components/ReportsDisplayContext.tsx`):
- Provider value `{ pnlMode: "net" | "gross", unitMode: "abs" | "pct", denominator: number, currency: string, fxRate: number, locale: string }`, supplied by `ReportsView` from its props + the selected account's `starting_balance` (summed across accounts when "all"; denominator `0`/absent disables `%` — the toggle falls back to `$` and is disabled with a tooltip).
- Hook `useReportsMoney()` returns:
  - `pnl(summary: Summary): number` — `pnlMode === "gross" ? summary.gross_profit - summary.gross_loss : summary.net_pnl`.
  - `tradePnl(trade): number` — `pnlMode === "gross" ? trade.gross_pnl : trade.net_pnl` (for trades-based cards).
  - `format(value: number): string` — `unitMode === "pct"` → `fmtPct(value * fxRate / denominator)`; else `fmtSignedMoney(value * fxRate, currency, locale)`.
  - `formatCompact(value)` — the compact variant for axis ticks.
- The context replaces raw per-card money formatting; `fxRate`/`currency`/`locale` move into it so cards stop taking them individually where practical (kept as props where a card is used outside Reports).

**Card refactor** — thread the modes through every P&L surface:
- Summary/KPI cards (`ReportsSummaryBento`/`SummaryMetricsGrid`, `ReportsInsightWidgets`), breakdown cards (`ReportsBreakdownCard`, `ReportsHourlyList`, `ReportsSessionTable`, `ReportsExecutionGrade`, `ReportsSymbolHeatmap`), and trend/risk charts (`ReportsRollingWinRate`, `ReportsMetricEvolution`, `ReportsRMultiplePerformance`, `ReportsRiskDrawdown`) call `useReportsMoney()` for values, formatting, and recharts `tickFormatter`s. Chart series map `pnl()`/`tradePnl()` so bars/areas reflect Net vs Gross; axis and tooltip formatters use `format()`.
- Where a component is also used outside Reports (e.g. shared bento), guard with an optional context (default net/$).
- Control bar gains the `Net|Gross` and `$|%` `SegmentedControl`s.

**Tests:** `ReportsDisplayContext` unit tests for `pnl`/`format` across the mode matrix (net-$, gross-$, net-%, gross-%, zero-denominator guard); representative card tests asserting a card re-expresses its value under gross and under % (e.g. `ReportsExecutionGrade` shows gross figures in gross mode, a percentage in % mode); control-bar test for the two new toggles.

## Rollout / verification

- Go tests green (`cd api && go test ./...`); frontend units green (`bun run test`); full typecheck+lint clean (`bun run lint`).
- Runtime (`run`/`web:verify`): toggle Net↔Gross and $↔% and confirm every card + chart re-expresses consistently; set Side=Long and Duration=Scalp and confirm the whole page's data narrows; confirm all four persist in the URL and deep-link; confirm `%` disables gracefully when starting balance is 0. Light/dark + mobile/desktop.

## Files (indicative)

- **Stage 1** — Modify: `api/internal/api/filters.go` (+ test), `api/internal/api/dto.go`, `api/internal/api/breakdown_handler_test.go`; `web/src/routes/reports.tsx`, `web/src/lib/api/*` (Filters type), `web/src/app/screens/ReportsView.tsx`. New: `web/src/components/ReportsControlBar.tsx` (+ test).
- **Stage 2** — New: `web/src/components/ReportsDisplayContext.tsx` (+ test). Modify: `ReportsView.tsx` + the ~11 Reports card/chart components and their tests; `ReportsControlBar.tsx` (add the two mode toggles).
- No schema or persisted-type changes.
