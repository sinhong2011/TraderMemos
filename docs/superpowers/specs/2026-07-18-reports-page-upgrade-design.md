# Reports Page Upgrade — Design

**Date:** 2026-07-18
**Scope:** `web/src/app/screens/ReportsView.tsx`, `web/src/routes/reports.tsx`, new `web/src/components/Reports*.tsx`, new `web/src/lib/reportsAnalytics.ts`
**Approved:** Cluster A only (see Out of scope)

## Problem

The current Reports page has two cards: a flat 9-tile Statistics grid (with a
$/R unit toggle that switches the whole grid), an equity chart, an R-multiple
chip row, and a single Breakdown card that shows one dimension at a time via a
7-way selector (symbol/setup/day_of_week/hour_of_day/session/tag/mistake).

A reference trading-journal stats page (Stonk Journal) demonstrates several
info patterns we're missing: rolling win rate, multi-metric trend-over-time,
always-visible per-dimension breakdowns (not one-at-a-time), a proper R
distribution chart, a session performance table, and drawdown/risk stats. This
spec adopts the parts of that reference buildable from data we already have
client-side, following the same pattern `DashboardInsightBento` /
`dashboardInsights.ts` already use on the Dashboard page.

## Out of scope

- **Compliance Impact** (rule-compliant vs. actual equity curves) — requires
  retroactively replaying historical trades against risk rules that may have
  changed over time. Genuinely separate feature; own spec later.
- **Position Size Calculator** — already exists (`PositionSizeModal.tsx`,
  `RCalculatorView.tsx`); not duplicated here.

## Data layer

**`routes/reports.tsx`:**
- Add `useTrades(filters)` — same hook and same `filters` object `dashboard.tsx`
  already uses, so it respects the existing global date/account filters.
- Add four more `useBreakdown(dim, filters)` calls: `symbol`, `tag`,
  `day_of_week`, `hour_of_day`, plus `session` (five total, parallel react-query
  hooks, same pattern as the existing single-dim query).
- Remove `unit` / `onUnitChange` state — the $/R toggle goes away; `rSummary`
  is always rendered instead of being conditional.
- Pass `trades`, `tradesLoading`, `tradesError`, and the five breakdown query
  results down to `ReportsView`.

**New `lib/reportsAnalytics.ts`** (pure functions, sibling to
`dashboardInsights.ts`, unit-tested the same way):
- `rollingWinRate(trades, window): { index: number; rate: number }[]` —
  chronological closed trades, sliding window over win/loss.
- `metricEvolution(trades, granularity: "day" | "week" | "month"): EvolutionPoint[]`
  — buckets closed trades by period; each point carries win rate, cumulative
  P&L, profit factor, expectancy, avg P&L/trade.
- `drawdownSeries(points: EquityPoint[]): { at: string; drawdownPct: number }[]`
  plus `currentDrawdownPct` / `maxDrawdownPct` helpers — running peak vs. each
  equity point.
- `avgRiskPerTrade(trades): { avg: number | null; included: number; excluded: number }`
  — averages `Trade.initial_risk` where present; same exclusion-note style
  already used for R stats ("9 of 18 trades").

Hold-time (Avg Win Hold/Avg Loss Hold tiles) and Longest Losing Streak (Risk &
Drawdown tile) need no new code: `computeDashboardInsights(trades)` from
`dashboardInsights.ts` is already exported and pure, and already returns
`winHoldSecs`, `lossHoldSecs`, and `worstStreak`. Reports calls it directly and
reads the fields it needs, same as Dashboard does — no extraction, no
duplication.

**Session Performance** needs no new lib function — it maps the `session`
`BreakGroup[]` directly into table rows (trades/win rate/net P&L/avg-per-trade
are already on `BreakGroup.summary`).

## Layout (top to bottom)

```
Page (gap-4 on void bg-bg)
├─ Card "Statistics" — SummaryMetricsGrid (existing 9 tiles + 2 new:
│    Avg Win Hold, Avg Loss Hold) + equity curve (existing, unchanged).
│    No more $/R toggle — always dollar view.
├─ ReportsRollingWinRate — own Card, window selector (10/20/50/100),
│    hero %, line chart
├─ ReportsMetricEvolution — own Card, Day/Week/Month selector, dual-axis
│    line chart (Win Rate % fixed left axis; right axis swappable among
│    Cumulative P&L / Profit Factor / Expectancy / Avg P&L per Trade)
├─ ReportsRMultiplePerformance — own Card, 4 StatCards (Avg R/Trade,
│    Avg Winning R, Avg Losing R, Best/Worst R)
├─ ReportsRDistributionChart — own Card, colored bar chart (replaces
│    today's chip row)
├─ grid lg:cols-2
│  ├─ ReportsBreakdownCard(dim="symbol", withTableToggle) — horizontal bars
│  └─ ReportsBreakdownCard(dim="tag", withTableToggle) — horizontal bars
├─ grid lg:cols-2
│  ├─ ReportsBreakdownCard(dim="day_of_week") — vertical bars
│  └─ ReportsBreakdownCard(dim="hour_of_day") — vertical bars
├─ ReportsSessionTable — own Card, table (Session/Trades/Win %/Net P&L/
│    Avg per Trade)
├─ ReportsRiskDrawdown — own Card, 4 StatCards (Max Drawdown %, Current
│    Drawdown %, Longest Losing Streak, Avg Risk/Trade) + drawdown % chart
└─ Card "Breakdown" (existing, trimmed) — selector now offers only
     "Setup" and "Mistake" (the two dims without a dedicated card above);
     same bar+table UI as today
```

## New components

| Component | Owns | Depends on |
|---|---|---|
| `ReportsRollingWinRate` | Card + window selector + hero % + line chart | `trades` |
| `ReportsMetricEvolution` | Card + granularity + right-axis selector + dual-axis line chart | `trades` |
| `ReportsRMultiplePerformance` | Card + 4 `StatCard`s | `rSummary` |
| `ReportsRDistributionChart` | Card + colored bar chart | `rSummary.distribution` |
| `ReportsBreakdownCard` (generic, reused ×4) | Card + bar chart, optional Chart/Table toggle (symbol & tag only) | one `BreakGroup[]` per dim |
| `ReportsSessionTable` | Card + table | `session` breakdown |
| `ReportsRiskDrawdown` | Card + 4 `StatCard`s + drawdown % chart | `trades`, `equity` |

All follow the existing `Dashboard*` composition pattern: each component owns
its `Card` and its own loading/error/empty state, keeping `ReportsView` a
composition list rather than a large conditional tree.

**Modified `ReportsView.tsx`:** drops $/R toggle and `SummaryMetricsGrid`'s
conditional unit logic (always dollar + 2 new hold-time tiles); trims
`DimSelector`/Breakdown card to `["setup", "mistake"]`; composes the new
components in the order above; exports `buildColumns` so
`ReportsBreakdownCard`'s table-toggle mode reuses it instead of duplicating
column defs.

## Loading, error, empty states

Same conventions already used across Dashboard/Reports — no new pattern:
- **Loading:** `Skeleton` sized to the component.
- **Error:** `text-loss` short message, same phrasing style as existing
  ("Failed to load summary.").
- **Empty:**
  - `ReportsRollingWinRate` — `EmptyState` if closed trades < 10 (smallest
    window).
  - `ReportsMetricEvolution` — `EmptyState` if zero closed trades in range.
  - `ReportsRMultiplePerformance` / `ReportsRDistributionChart` — `EmptyState`
    if `rSummary` is undefined or all trades excluded (no stop data).
  - `ReportsBreakdownCard` / `ReportsSessionTable` — reuse existing
    `<EmptyState title="No data" .../>`.
  - `ReportsRiskDrawdown` — Avg Risk/Trade shows "—" with an "N of M trades"
    hint when `initial_risk` is missing, rather than blocking the card.

Everything derives from the same `filters` object already wired through the
route, so account/date-range changes refetch exactly like the rest of the page
does today.

## Testing

- `lib/reportsAnalytics.test.ts` — unit tests per pure function, same style as
  `dashboardInsights.test.ts` (small `Trade[]`/`EquityPoint[]` fixtures, exact
  output assertions).
- `ReportsView.test.tsx` (existing) — extend for: hold-time tiles, $/R toggle
  removed, trimmed dim selector (Setup/Mistake only).
- Dedicated component tests only where there's non-trivial branching:
  `ReportsRollingWinRate`, `ReportsMetricEvolution` (axis-swap logic).
  Simpler stat-tile/table components are covered indirectly through
  `ReportsView.test.tsx`, consistent with how `DashboardAccountContribution`
  is tested today.
- Check during implementation whether an existing Reports e2e test needs
  updating for the removed $/R toggle.
- Validate with `vp check` + `vp test` from `web/`.
