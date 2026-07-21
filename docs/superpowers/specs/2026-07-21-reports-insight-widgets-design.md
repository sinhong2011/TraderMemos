# Reports Insight Widgets — Gauge & Donut Upgrade

**Date:** 2026-07-21
**Status:** Approved (design)
**Scope:** Sub-project 1 of a 4-stage Reports upgrade inspired by the Tradervue Dashboard/Reports screenshots.

## Context

The Reports page (`web/src/app/screens/ReportsView.tsx`) already exceeds the reference
screenshots on analytics depth (equity curve, R-multiple performance, rolling win-rate,
metric evolution, session breakdown, risk/drawdown). A feature audit of the two Tradervue
screenshots (plus a gap the user flagged) decomposed the work into staged sub-projects:

1. **Visual widgets** (this spec) — profit-factor gauge, win/loss donut, avg win-vs-loss split bar. Frontend-only.
2. **Setup-rating (execution-grade) breakdown** — performance grouped by the 1–5 `trade_quality`
   rating ("do my A-grade setups make money?"). Small backend addition (new `trade_quality`
   breakdown dimension, mirroring the existing `setup` dim) + a frontend breakdown card.
3. Open-trades table.
4. Tab organization (Overview / Detailed / Win-Loss / Risk).
5. Filter + control bar (Gross/Net toggle, Side/Duration, $/% view) — carries the most backend risk; done last.

This spec covers **Sub-project 1 only**.

## Problem

The app already has a component explicitly modeled on Tradervue — `web/src/components/ReportsInsightWidgets.tsx` —
rendering four cells: Profit Factor, Winning vs Losing, Avg Win vs Avg Loss, Payoff ratio.
All four currently use **flat horizontal progress bars**. The screenshots use richer visuals
(a radial gauge and a donut) that read faster and carry more visual hierarchy. This sub-project
upgrades the two hero cells to those visuals while preserving the component's pure, prop-driven shape.

## Goals

- Replace the Profit Factor flat bar with an **arc-fill radial gauge** (no needle — decided).
- Replace the Winning vs Losing split bar with a **donut** (win-rate % in the center hole).
- Unify Avg Win vs Avg Loss into a **single horizontal split bar** with a dollar value at each end.
- Keep Payoff ratio unchanged (preserves the balanced 4-up grid).
- Introduce two reusable, independently-testable SVG primitives.

## Non-Goals

- No recharts usage for these widgets (pure inline SVG — lightweight, token-driven, animatable).
- No Gross/Net toggle, Side/Duration filters, tabs, or open-trades table (later sub-projects).
- No backend/API changes. All data comes from the existing `Summary` object.

## Design

### Data source

All values derive from the existing `Summary` type (`web/src/lib/api/types.ts`):
`profit_factor`, `wins`, `losses`, `breakeven`, `win_rate`, `avg_win`, `avg_loss`.
No new fields, no new requests. The component stays pure: `Summary` in → SVG out. A future
Gross/Net toggle (Sub-project 4) will feed a different `Summary`; no rework needed here.

### Primitives (new files under `web/src/components/charts/`)

**`GaugeArc.tsx`** — presentational arc-fill gauge.
- Props: `value` (0–1 fraction of the track that is filled), plus optional `size`, `strokeWidth`,
  `trackColor`, and `fillColor`/`fillGradient` (id + stops). No data/business logic.
- Renders a 180° semicircle: a base track (`--color-bg-inset`) and a colored fill arc from the
  left end to `value`. Fill sweeps `--color-loss → --color-signal → --color-profit` via an SVG
  `linearGradient`. Uses `stroke-dasharray`/`stroke-dashoffset` on a half-circle path for the fill.
- Children render centered inside the arc (the caller places the PF number there).

**`DonutRing.tsx`** — presentational donut.
- Props: `segments: { value: number; color: string }[]`, plus `size`, `strokeWidth`. No data logic.
- Renders concentric `stroke-dasharray` arcs on a single `<circle>` per segment (rotated so they
  chain). Degenerate case (all-zero) renders a full muted track.
- Children render centered in the hole (the caller places win-rate % + record there).

Both are ~static SVG, animate via CSS transitions on the dash offset, and accept `className`.

### Widget rework (`ReportsInsightWidgets.tsx`)

Keep the existing `WidgetShell` and the 2-col→4-col responsive grid. Gauge & donut cells get a
taller `min-h` (~140px) so the SVG has room.

1. **Profit factor** → `<GaugeArc value={pfFraction}>` with the PF number centered.
   - `pfFraction = pf <= 0 ? 0 : Math.min(1, pf / 3)` (PF 3.0+ caps the arc; mirrors existing `pfBar` logic).
   - Caption "1.0 = break-even edge" retained.
2. **Winning vs losing** → `<DonutRing segments={[wins→profit, losses→loss, breakeven→muted]}>`
   with `fmtPct(win_rate)` large in the hole and the `WinLossRecord` beneath.
3. **Avg win vs avg loss** → single split bar: green segment width `avgWin/(avgWin+avgLoss)`, rose
   segment the remainder; `fmtMoney(avgWin)` left-aligned, `fmtMoney(avgLoss)` right-aligned above
   the bar. Degenerate case (both 0) renders an empty inset track.
4. **Payoff ratio** → unchanged.

### Colors / tokens

- Profit `--color-profit` (#4ade80), Loss `--color-loss` (#fb7185), mid `--color-signal` (#a78bfa),
  track/base `--color-bg-inset` (#121218). No new tokens.

## Testing (TDD)

Write tests first, then implement.

- **`GaugeArc.test.tsx`** — for value 0, 0.5, 1: the fill arc's `stroke-dashoffset` matches the
  expected fraction of the half-circle length; renders children.
- **`DonutRing.test.tsx`** — segment dash lengths are proportional to values; all-zero renders a
  single muted track; renders children in the hole.
- **`ReportsInsightWidgets.test.tsx`** (extend existing) — PF gauge shows the PF value and maps to
  the expected fraction; donut shows win-rate % and record; split bar shows both dollar values;
  edge cases: 0 trades (win_rate 0, empty segments), PF=0 (arc empty, "—"), avgLoss=0
  (payoff "∞", split bar all-green).

## Rollout / verification

- Unit tests green (`vitest`), TypeScript clean (`tsc --noEmit`).
- Runtime check via the `web:verify` skill: open Reports, confirm the gauge fills to the PF
  position, the donut hole shows win-rate %, and the split bar shows both dollar values, in both
  light and dark themes and at mobile + desktop widths.

## Files

- New: `web/src/components/charts/GaugeArc.tsx`, `web/src/components/charts/DonutRing.tsx`
  (+ their `.test.tsx`).
- Modified: `web/src/components/ReportsInsightWidgets.tsx` and its test.
- No route, API, or type changes.
