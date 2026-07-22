# Reports Tab Organization + Stock P&L Heatmap

**Date:** 2026-07-21
**Status:** Approved (design)
**Scope:** Sub-project 4 of the staged Reports upgrade, plus a follow-on stock P&L heatmap card the user requested. Both are frontend-only changes to the same `ReportsView`, so they share one spec.

## Context

The Reports page (`web/src/app/screens/ReportsView.tsx`) renders ~10 stacked sections in one long scroll: a KPI metrics grid, Playbook & Leaks (dimension breakdown selector), Rolling Win-Rate, Metric Evolution, R-Multiple, Execution Grade (SP2), Symbol/Tag/Day/Hour/Session breakdowns, and Risk/Drawdown. The staged upgrade calls for tab organization to tame the scroll (SP4). The user additionally asked for a stock P&L heatmap; it reuses the existing per-symbol breakdown data and naturally belongs in the breakdowns group, so it is folded in here.

Prior sub-projects: SP1 (visual widgets) and SP2 (execution-grade breakdown) are done. SP3 (open-trades table) is skipped. SP5 (filter/control bar) remains and is out of scope here.

## Goals

1. Group the Reports sections into four tabs to reduce scroll and clarify structure.
2. Persist the active tab in the URL (`?tab=`) so it survives refresh and is shareable.
3. Add a stock P&L heatmap (treemap) card to the Detailed tab, reusing existing symbol data.

## Non-Goals

- No filter/control bar (SP5).
- No changes to any card's internals or to the breakdown/analytics APIs.
- No backend changes — the heatmap consumes the existing `symbolBreakdown`.
- No sticky/floating tab bar (possible later polish).

## Design

### Part A — Tab organization

**Tab set** (value → label), grouped sections:

| value | label | sections |
|---|---|---|
| `overview` | Overview | KPI metrics grid · Playbook & Leaks · R-Multiple · Execution Grade |
| `win-loss` | Win / Loss | Rolling Win-Rate · Metric Evolution |
| `detailed` | Detailed | Symbol · Tag · Day of Week · Hour · Session · **Stock P&L heatmap** |
| `risk` | Risk | Risk / Drawdown |

`overview` is the default. The section-to-tab mapping above is exact.

**Type:** add `export type ReportsTab = "overview" | "win-loss" | "detailed" | "risk";` in `ReportsView.tsx`.

**Route** (`web/src/routes/reports.tsx`):
- Add `validateSearch` to the route so `tab` is a validated search param defaulting to `overview`; an unknown value coerces to `overview`. (This is the app's first `validateSearch`; standard TanStack Router.)
- Read the current tab via `Route.useSearch()`; change it via `useNavigate` (`navigate({ search: (prev) => ({ ...prev, tab }) })`).
- Pass `tab` and `onTabChange` into `ReportsView`, mirroring the existing `dim` / `onDimChange` prop pattern (keeps `ReportsView` presentational).

**ReportsView** (`web/src/app/screens/ReportsView.tsx`):
- Add `tab: ReportsTab` and `onTabChange: (t: ReportsTab) => void` to `ReportsViewProps`.
- Wrap the section list in the existing Base-UI `Tabs` primitives (`web/src/components/Tabs.tsx`): `<Tabs value={tab} onValueChange={(v) => onTabChange(v as ReportsTab)}>` containing a `TabsList` (four `TabsTrigger`s + a `TabsIndicator`) and four `TabsContent` panels holding the grouped sections verbatim. `TabsContent`/Base-UI `Tabs.Panel` unmounts inactive panels by default, so only the active tab's cards are in the DOM.
- The KPI block (the `summaryLoading ? … : summary ? <SummaryMetricsGrid/> : null` ternary) moves inside the Overview panel unchanged.
- `TabsList` styling reuses the app's pill/underline treatment (same tokens as `SegmentedControl`); it is horizontally scrollable on narrow widths (`overflow-x-auto`), though the four short labels fit most phones.

### Part B — Stock P&L heatmap (treemap)

**New component** `web/src/components/ReportsSymbolHeatmap.tsx`:
- Props: `{ breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number }` — same shape as the sibling breakdown cards. Fed the existing `symbolBreakdown` (already queried in the route; no new query).
- Renders a recharts `<Treemap>` (recharts 3.9.2, already a dependency) inside the standard `Card` (title "Stock P&L") and `ChartFrame`/`ResponsiveContainer`:
  - Data: one node per symbol `{ name: g.key, size: g.summary.total_trades, netPnl: g.summary.net_pnl }`. `dataKey="size"` → tile area encodes trade count (activity). Symbols with `total_trades === 0` are dropped (a treemap needs positive size).
  - A custom cell `content` colors each tile by net P&L: green (`--color-profit`) for ≥0, rose (`--color-loss`) for <0, opacity scaled by `|netPnl| / maxAbs` (floor ~0.25 so small movers stay visible), where `maxAbs = max(1, …|netPnl|)`. The tile shows the symbol and `fmtMoneyCompact(netPnl * fxRate, currency, locale)` when the tile is large enough to fit text.
  - Tooltip shows symbol, `fmtSignedMoney(netPnl * fxRate, …)`, and trade count.
- States: `Skeleton height="220px"` while loading; `<p className="text-xs text-loss">Failed to load…</p>` on error; `EmptyState` when no symbols with trades — matching the sibling cards' exact patterns.
- Uses `usePrivacyMode()` and `intlLocale()` like the other Reports cards; honors `fxRate`.
- Placed in the **Detailed** tab panel (after the Session table).

### Colors / tokens

Reuse existing tokens only: `--color-profit`, `--color-loss`, `pnlColor`, plus `chartTheme` from `ChartFrame`. No new tokens or dependencies.

## Testing (TDD)

- **`ReportsView.test.tsx`** (extend): add `tab`/`onTabChange` to the base props; assert that with `tab="overview"` the Execution Grade / R-Multiple cards render and a Detailed-only card (e.g. "Session") does not; with `tab="detailed"` the Symbol/Session cards render and an Overview-only card does not; clicking a `TabsTrigger` calls `onTabChange` with the right value.
- **`reports.route`/container test** (or extend existing route coverage if present): `?tab=detailed` selects the Detailed panel; missing/invalid `tab` falls back to `overview`.
- **`ReportsSymbolHeatmap.test.tsx`** (new): builds treemap nodes from `breakdown` (size = total_trades, netPnl = net_pnl); a symbol with 0 trades is excluded; positive vs negative net P&L map to profit vs loss colors; empty input renders the empty state. (Recharts renders to SVG in jsdom; assert on the derived node model / accessible text rather than pixel layout — follow the mocking approach used by existing recharts-based card tests.)

## Rollout / verification

- Frontend unit tests green (`bun run test`); TypeScript + lint clean on changed files (`bun run lint`).
- Runtime check via the `run`/`web:verify` skill (batched with SP2): open Reports, switch all four tabs, confirm each shows its group and only its group; confirm `?tab=detailed` deep-links; confirm the Stock P&L treemap tiles are sized by trade count and colored by P&L, in light and dark themes and at mobile + desktop widths.

## Files

- New: `web/src/components/ReportsSymbolHeatmap.tsx` (+ `.test.tsx`).
- Modified: `web/src/app/screens/ReportsView.tsx` (+ `ReportsView.test.tsx`), `web/src/routes/reports.tsx` (+ route test).
- No API, schema, or persisted-type changes.
