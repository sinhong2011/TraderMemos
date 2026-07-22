# Statistics Card Visual Hierarchy — Design

**Date:** 2026-07-19
**Scope:** `web/src/components/StatCard.tsx`, `web/src/app/screens/ReportsView.tsx`
**Approved:** Yes

**Note:** the cell/grid treatment described below (`gap-px bg-border`
hairlines, `variant="flush"`) was superseded during implementation — see
`docs/superpowers/plans/2026-07-19-statistics-card-hierarchy.md`'s Task 3 and
Global Constraints for the shipped `variant="bento"` + `gap-3` treatment.

## Problem

The Reports page's Statistics card (`SummaryMetricsGrid` in `ReportsView.tsx`)
renders 15 stats as one flat `grid-cols-5` hairline grid, all at identical
visual weight. Two issues, found via user annotation on a screenshot:

1. 15 items in a 5-column grid orphaned the last row (5+5+5 is fine, but the
   set grew to 15 by ad-hoc addition — see history below — with no grouping,
   so it read as an undifferentiated wall of numbers).
2. Per-cell `border` + `border-radius` on `StatCard` double-bordered against
   the parent's own `gap-px bg-border` hairline technique, and the cell
   background matched the parent `Card`'s background exactly — so cells were
   only visible via boxy outlines, not as a designed surface.

(2) was already fixed in a prior pass: `StatCard` gained a `variant="flush"`
mode (no border/radius, background-only) matching the existing `BentoStat`
pattern in `TradeDetailSheet.tsx`. That fix was correct but insufficient —
removing the boxes made the flatness/uniformity of (1) more visible, not less.
This spec fixes (1): give the 15 stats a real information hierarchy instead of
uniform treatment, per `DESIGN.md`'s own mandate ("numbers are the hero",
"asymmetric bento ... not equal card grid", "compact cockpit density").

## Design

Split the flat list into three labeled tiers, five stats each — no orphaned
rows at any breakpoint, and each tier is a semantically coherent group a
trader scans independently:

| Tier | Label | Stats | Type size |
|---|---|---|---|
| 1 | Performance | P&L, Win Rate, Profit Factor, Total Trades, Expectancy | `lg` (26px, a deliberate custom size — not `DESIGN.md`'s `text-stat` token, which resolves to 32px; kept at 26px per explicit user choice after seeing both) |
| 2 | Trade Quality | Avg Win, Avg Loss, Largest Win, Largest Loss, Avg Trade | `md` (today's existing 20px — unchanged) |
| 3 | Behavior & Costs | Avg Win Hold, Avg Loss Hold, Breakeven, Best Streak, Total Fees | `sm` (~15px, tighter padding) |

Notes on the regrouping vs. the current flat order: Avg Trade moves out of
its ad-hoc trailing position into Trade Quality (it's a trade-outcome-size
metric like Avg Win/Avg Loss); the two hold-time stats move into Behavior &
Costs alongside Breakeven/Best Streak/Total Fees (all are behavioral/timing/
cost facts, not core $ performance).

Each tier gets a small label above its row: 10px, uppercase, `text-text-muted`
(deliberately **not** `text-signal`) — the card's own title ("Statistics")
already uses `text-signal`; reusing it on every sub-label would dilute the
"wayfinding" restraint `DESIGN.md` calls for. Tier label spacing: `pt-3 pb-1`
above each row, consistent with the `Card` body's existing `px-4` rhythm.

Hierarchy comes from **type scale and spacing only** — no new background
panels or elevation change on Tier 1, consistent with the borderless/unified-
void preference already established for this codebase. Each tier keeps the
existing `gap-px bg-border` hairline technique
(`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`) and `variant="flush"` — no
regression on the double-border fix.

## Component changes

**`StatCard.tsx`:** add a `size?: "lg" | "md" | "sm"` prop, default `"md"`
(today's unchanged 20px/`text-xl`), so the two other existing call sites
(`ReportsRiskDrawdown.tsx`, `ReportsRMultiplePerformance.tsx`) are untouched.
`"lg"` and `"sm"` only adjust the value `<span>`'s font-size/line-height (and
`"sm"` reduces the cell's vertical padding slightly for a denser feel); label
and hint styling stay the same across sizes.

**`ReportsView.tsx`:** add a small local `StatGroup` wrapper (label + the
existing hairline grid div) to avoid repeating the grid className string
three times. `SummaryMetricsGrid` renders three `StatGroup`s in the tier order
above, each `StatCard` passing `size` per its tier (accents/values/hints
unchanged from the current implementation).

## Out of scope

- No new data/computation — purely a presentational regrouping of stats
  already computed (`Summary`, `computeDashboardInsights`).
- No change to the Equity Curve sub-section below the stats, or to any other
  Reports card.
- No change to `StatCard` usages outside `SummaryMetricsGrid`.

## Testing

- Extend `ReportsView.test.tsx` to assert the three tier labels render
  ("Performance", "Trade Quality", "Behavior & Costs") and that stat labels
  still render as before (grouping is presentational; existing assertions on
  individual stat values/labels should keep passing largely unchanged).
- Manual visual check in-browser at the `lg` (5-col) and `sm`/base
  breakpoints, same as done for the prior two passes on this card.
- Validate with `vp check` + `vp test` from `web/`.
