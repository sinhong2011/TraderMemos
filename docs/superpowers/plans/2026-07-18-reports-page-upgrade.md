# Reports Page Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Reports page with rolling win rate, metric-evolution trends, always-visible per-dimension breakdown cards, a real R-multiple distribution chart, a session performance table, and risk/drawdown stats — all computed client-side from data already fetched today.

**Architecture:** New pure-function module `lib/reportsAnalytics.ts` (sibling to the existing `lib/dashboardInsights.ts`) computes rolling win rate, metric-evolution buckets, drawdown %, and avg risk/trade from the trade list the Reports route already fetches (or newly fetches via the existing `useTrades` hook). New self-contained `Reports*` components (mirroring the existing `Dashboard*` component family) each own their `Card`, loading/error/empty states, and are composed into `ReportsView`. No backend changes.

**Tech Stack:** React, TanStack Router/Query/Table, Recharts, Zustand, Vite+ (`vp check`, `vp test`), Vitest (`vite-plus/test`), Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-reports-page-upgrade-design.md` — Cluster A only. Compliance Impact and Position Size Calculator are explicitly out of scope.
- No new backend endpoints — all new computation is client-side pure functions over `Trade[]` / `EquityPoint[]`.
- Follow `docs/superpowers/specs/2026-07-18-reports-page-upgrade-design.md`'s component table exactly: each new `Reports*` component owns its own `Card` + loading/error/empty state.
- Borderless design (`CLAUDE.md`): one `Card` per logical block, `bg-bg-panel` elevation, no decorative borders on cards themselves.
- `DESIGN.md`: signal yellow (`--color-signal` / `text-signal`) is reserved for wayfinding — never use it to color P&L-adjacent chart lines or bars. Use `--color-profit` / `--color-loss` (green/red) for P&L semantics and `chartTheme.accentStroke` (purple) for neutral percentage metrics.
- Validate every task with `vp check` and `vp test` run from `web/`.
- All new files live under `web/src/`; commands below assume `cd web` first (noted per task where it matters).

---

### Task 1: `reportsAnalytics.ts` — rolling win rate + metric evolution

**Files:**
- Modify: `web/src/lib/dashboardInsights.ts` (export `chronologicalClosed`)
- Create: `web/src/lib/reportsAnalytics.ts`
- Test: `web/src/lib/reportsAnalytics.test.ts`

**Interfaces:**
- Consumes: `Trade` from `web/src/lib/api/types.ts` (`net_pnl: number | null`, `closed_at: string | null`, `opened_at: string`, `status: string`).
- Produces: `chronologicalClosed(trades: Trade[]): Trade[]` (now exported from `dashboardInsights.ts`); `rollingWinRate(trades: Trade[], windowSize: number): { index: number; rate: number }[]`; `type EvolutionGranularity = "day" | "week" | "month"`; `interface EvolutionPoint { bucket: string; winRate: number; cumulativePnl: number; profitFactor: number; expectancy: number; avgPnlPerTrade: number }`; `metricEvolution(trades: Trade[], granularity: EvolutionGranularity): EvolutionPoint[]`.

- [ ] **Step 1: Export `chronologicalClosed` from `dashboardInsights.ts`**

In `web/src/lib/dashboardInsights.ts`, change:

```ts
function chronologicalClosed(trades: Trade[]): Trade[] {
```

to:

```ts
export function chronologicalClosed(trades: Trade[]): Trade[] {
```

- [ ] **Step 2: Run existing dashboard tests to confirm nothing broke**

Run: `cd web && vp test src/lib/dashboardInsights.test.ts`
Expected: PASS (export keyword doesn't change behavior).

- [ ] **Step 3: Write failing tests for `rollingWinRate`**

Create `web/src/lib/reportsAnalytics.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "./api/types";
import { metricEvolution, rollingWinRate } from "./reportsAnalytics";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("rollingWinRate", () => {
  it("returns no points when there are fewer trades than the window", () => {
    const trades = [trade({ id: "1", net_pnl: 10 }), trade({ id: "2", net_pnl: -5 })];
    expect(rollingWinRate(trades, 3)).toEqual([]);
  });

  it("computes a trailing win rate once the window fills, in chronological order", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 10 }),
      trade({ id: "2", closed_at: "2026-07-02T12:00:00Z", net_pnl: 10 }),
      trade({ id: "3", closed_at: "2026-07-03T12:00:00Z", net_pnl: -5 }),
      trade({ id: "4", closed_at: "2026-07-04T12:00:00Z", net_pnl: 10 }),
    ];
    const points = rollingWinRate(trades, 3);
    expect(points).toEqual([
      { index: 3, rate: 2 / 3 },
      { index: 4, rate: 2 / 3 },
    ]);
  });
});

describe("metricEvolution", () => {
  it("returns cumulative-to-date stats per day bucket", () => {
    const trades = [
      trade({ id: "1", closed_at: "2026-07-01T12:00:00Z", net_pnl: 100 }),
      trade({ id: "2", closed_at: "2026-07-01T14:00:00Z", net_pnl: -40 }),
      trade({ id: "3", closed_at: "2026-07-02T12:00:00Z", net_pnl: 20 }),
    ];
    const points = metricEvolution(trades, "day");
    expect(points).toHaveLength(2);
    expect(points[0].bucket).toBe("2026-07-01");
    expect(points[0].winRate).toBeCloseTo(0.5);
    expect(points[0].cumulativePnl).toBe(60);
    expect(points[1].bucket).toBe("2026-07-02");
    expect(points[1].winRate).toBeCloseTo(2 / 3);
    expect(points[1].cumulativePnl).toBe(80);
  });

  it("returns an empty array with no closed trades", () => {
    expect(metricEvolution([trade({ status: "open", net_pnl: null })], "day")).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd web && vp test src/lib/reportsAnalytics.test.ts`
Expected: FAIL with "Cannot find module './reportsAnalytics'" (or similar — the file doesn't exist yet).

- [ ] **Step 5: Implement `rollingWinRate` and `metricEvolution`**

Create `web/src/lib/reportsAnalytics.ts`:

```ts
import type { Trade } from "./api/types";
import { chronologicalClosed } from "./dashboardInsights";

export interface RollingWinRatePoint {
  index: number;
  rate: number;
}

/** Win rate over a trailing window of N chronological closed trades. One point per trade once the window fills. */
export function rollingWinRate(trades: Trade[], windowSize: number): RollingWinRatePoint[] {
  const closed = chronologicalClosed(trades);
  if (closed.length < windowSize) return [];
  const points: RollingWinRatePoint[] = [];
  for (let i = windowSize - 1; i < closed.length; i++) {
    let wins = 0;
    for (let j = i - windowSize + 1; j <= i; j++) {
      if ((closed[j].net_pnl ?? 0) > 0) wins += 1;
    }
    points.push({ index: i + 1, rate: wins / windowSize });
  }
  return points;
}

export type EvolutionGranularity = "day" | "week" | "month";

export interface EvolutionPoint {
  bucket: string;
  winRate: number;
  cumulativePnl: number;
  profitFactor: number;
  expectancy: number;
  avgPnlPerTrade: number;
}

function bucketKey(iso: string, granularity: EvolutionGranularity): string {
  const d = new Date(iso);
  if (granularity === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (granularity === "week") {
    const dayOfWeek = d.getUTCDay();
    const diffFromMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diffFromMonday);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Cumulative-to-date metrics, one point per period, so trends plateau as
 * history accumulates. `expectancy` uses the same formula as the backend's
 * `Summary.expectancy` (winRate*avgWin - lossRate*avgLoss); `avgPnlPerTrade`
 * is a plain average, so the two lines are related but not identical.
 */
export function metricEvolution(
  trades: Trade[],
  granularity: EvolutionGranularity,
): EvolutionPoint[] {
  const closed = chronologicalClosed(trades);
  if (closed.length === 0) return [];

  const byBucket = new Map<string, Trade[]>();
  for (const t of closed) {
    const key = bucketKey(t.closed_at ?? t.opened_at, granularity);
    const list = byBucket.get(key);
    if (list) list.push(t);
    else byBucket.set(key, [t]);
  }
  const buckets = [...byBucket.keys()].sort();

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let cumulativePnl = 0;
  let count = 0;
  const points: EvolutionPoint[] = [];

  for (const bucket of buckets) {
    const bucketTrades = byBucket.get(bucket);
    if (!bucketTrades) continue;
    for (const t of bucketTrades) {
      const pnl = t.net_pnl ?? 0;
      cumulativePnl += pnl;
      count += 1;
      if (pnl > 0) {
        wins += 1;
        grossProfit += pnl;
      } else if (pnl < 0) {
        losses += 1;
        grossLoss += -pnl;
      }
    }
    const winRate = count > 0 ? wins / count : 0;
    const avgWin = wins > 0 ? grossProfit / wins : 0;
    const avgLoss = losses > 0 ? grossLoss / losses : 0;
    const lossRate = count > 0 ? losses / count : 0;
    points.push({
      bucket,
      winRate,
      cumulativePnl: Math.round(cumulativePnl * 100) / 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      expectancy: Math.round((winRate * avgWin - lossRate * avgLoss) * 100) / 100,
      avgPnlPerTrade: Math.round((cumulativePnl / count) * 100) / 100,
    });
  }
  return points;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd web && vp test src/lib/reportsAnalytics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/dashboardInsights.ts web/src/lib/reportsAnalytics.ts web/src/lib/reportsAnalytics.test.ts
git commit -m "feat(web): add rolling win rate and metric evolution analytics"
```

---

### Task 2: `reportsAnalytics.ts` — drawdown series + avg risk per trade

**Files:**
- Modify: `web/src/lib/reportsAnalytics.ts`
- Modify: `web/src/lib/reportsAnalytics.test.ts`

**Interfaces:**
- Consumes: `EquityPoint` (`{ at: string; equity: number }`), `Trade.initial_risk?: number | null` from `web/src/lib/api/types.ts`.
- Produces: `interface DrawdownPoint { at: string; drawdownPct: number }`; `drawdownSeries(points: EquityPoint[]): DrawdownPoint[]`; `currentDrawdownPct(points: EquityPoint[]): number`; `maxDrawdownPct(points: EquityPoint[]): number`; `interface AvgRiskPerTrade { avg: number | null; included: number; excluded: number }`; `avgRiskPerTrade(trades: Trade[]): AvgRiskPerTrade`.

- [ ] **Step 1: Write failing tests**

Append to `web/src/lib/reportsAnalytics.test.ts` (add `EquityPoint` to the type import and add these `describe` blocks at the end of the file):

```ts
import type { EquityPoint, Trade } from "./api/types";
import { avgRiskPerTrade, currentDrawdownPct, drawdownSeries, maxDrawdownPct, metricEvolution, rollingWinRate } from "./reportsAnalytics";
```

(Replace the existing `import type { Trade } from "./api/types";` and `import { metricEvolution, rollingWinRate } from "./reportsAnalytics";` lines at the top of the file with the two lines above.)

```ts
describe("drawdownSeries", () => {
  it("tracks running peak-to-trough drawdown as a fraction", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 1200 },
      { at: "2026-07-03T00:00:00Z", equity: 900 },
      { at: "2026-07-04T00:00:00Z", equity: 1100 },
    ];
    const series = drawdownSeries(points);
    expect(series[0].drawdownPct).toBe(0);
    expect(series[1].drawdownPct).toBe(0);
    expect(series[2].drawdownPct).toBeCloseTo((900 - 1200) / 1200);
    expect(series[3].drawdownPct).toBeCloseTo((1100 - 1200) / 1200);
  });

  it("reports current and max drawdown from the same series", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 1200 },
      { at: "2026-07-03T00:00:00Z", equity: 900 },
    ];
    expect(maxDrawdownPct(points)).toBeCloseTo((900 - 1200) / 1200);
    expect(currentDrawdownPct(points)).toBeCloseTo((900 - 1200) / 1200);
  });

  it("returns 0 for an empty series", () => {
    expect(currentDrawdownPct([])).toBe(0);
    expect(maxDrawdownPct([])).toBe(0);
  });
});

describe("avgRiskPerTrade", () => {
  function trade(over: Partial<Trade>): Trade {
    return {
      id: "t1",
      account_id: "a1",
      symbol: "NQ",
      instrument_type: "future",
      direction: "long",
      status: "closed",
      opened_at: "2026-07-01T10:00:00Z",
      closed_at: "2026-07-01T11:00:00Z",
      qty_opened: 1,
      qty_remaining: 0,
      avg_entry_price: 100,
      avg_exit_price: 110,
      gross_pnl: 10,
      fees_total: 0,
      net_pnl: 10,
      pnl_currency: "USD",
      return_pct: 0.1,
      time_in_trade_secs: 3600,
      notes: "",
      tags: [],
      ...over,
    };
  }

  it("averages only trades with a positive initial_risk", () => {
    const trades = [
      trade({ id: "1", initial_risk: 100 }),
      trade({ id: "2", initial_risk: 200 }),
      trade({ id: "3", initial_risk: null }),
    ];
    const result = avgRiskPerTrade(trades);
    expect(result.avg).toBe(150);
    expect(result.included).toBe(2);
    expect(result.excluded).toBe(1);
  });

  it("returns null avg when no trades have risk set", () => {
    const result = avgRiskPerTrade([trade({ id: "1", initial_risk: null })]);
    expect(result.avg).toBeNull();
    expect(result.included).toBe(0);
    expect(result.excluded).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/lib/reportsAnalytics.test.ts`
Expected: FAIL — `drawdownSeries`, `currentDrawdownPct`, `maxDrawdownPct`, `avgRiskPerTrade` are not exported.

- [ ] **Step 3: Implement the functions**

Append to `web/src/lib/reportsAnalytics.ts`:

```ts
export interface DrawdownPoint {
  at: string;
  drawdownPct: number;
}

/** Running peak vs. each equity point, as a fraction (negative or zero). */
export function drawdownSeries(points: EquityPoint[]): DrawdownPoint[] {
  let peak = -Infinity;
  return points.map((p) => {
    if (p.equity > peak) peak = p.equity;
    const drawdownPct = peak > 0 ? (p.equity - peak) / peak : 0;
    return { at: p.at, drawdownPct };
  });
}

export function currentDrawdownPct(points: EquityPoint[]): number {
  const series = drawdownSeries(points);
  return series.length > 0 ? series[series.length - 1].drawdownPct : 0;
}

export function maxDrawdownPct(points: EquityPoint[]): number {
  const series = drawdownSeries(points);
  return series.reduce((min, p) => Math.min(min, p.drawdownPct), 0);
}

export interface AvgRiskPerTrade {
  avg: number | null;
  included: number;
  excluded: number;
}

/** Average planned risk ($) across trades with a stop set (`initial_risk`). */
export function avgRiskPerTrade(trades: Trade[]): AvgRiskPerTrade {
  const withRisk = trades.filter((t) => t.initial_risk != null && t.initial_risk > 0);
  const excluded = trades.length - withRisk.length;
  if (withRisk.length === 0) return { avg: null, included: 0, excluded };
  const sum = withRisk.reduce((acc, t) => acc + (t.initial_risk ?? 0), 0);
  return {
    avg: Math.round((sum / withRisk.length) * 100) / 100,
    included: withRisk.length,
    excluded,
  };
}
```

Also add `EquityPoint` to the import at the top of the file:

```ts
import type { EquityPoint, Trade } from "./api/types";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/lib/reportsAnalytics.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/reportsAnalytics.ts web/src/lib/reportsAnalytics.test.ts
git commit -m "feat(web): add drawdown series and avg risk per trade analytics"
```

---

### Task 3: Route wiring + drop $/R toggle + hold-time stat tiles

**Files:**
- Modify: `web/src/routes/reports.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `useTrades(filters)` from `web/src/lib/hooks/useTrades.ts`; `computeDashboardInsights(trades: Trade[])` from `web/src/lib/dashboardInsights.ts` (returns `.winHoldSecs`, `.lossHoldSecs`, `.worstStreak`, all already exported).
- Produces: `ReportsViewProps` gains `trades: Trade[]`, `tradesLoading: boolean`, `tradesError: boolean`, `rSummaryError?: boolean`, `equityError: boolean`; loses `unit`, `onUnitChange`.

- [ ] **Step 1: Update the route to fetch trades and drop the unit toggle**

In `web/src/routes/reports.tsx`, replace the whole file:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type BreakdownDim, ReportsView } from "../app/screens/ReportsView";
import { accountBaseCurrency } from "../lib/displayPrefs";
import { useFilterParams, useFilters } from "../lib/filters";
import { useAccounts } from "../lib/hooks/useAccounts";
import { useBreakdown, useEquityCurve, useRSummary, useSummary } from "../lib/hooks/useAnalytics";
import { useTrades } from "../lib/hooks/useTrades";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const filters = useFilterParams();
  const accountId = useFilters((s) => s.accountId);
  const [dim, setDim] = useState<BreakdownDim>("setup");

  const summaryQ = useSummary(filters);
  const rSummaryQ = useRSummary(filters);
  const equityQ = useEquityCurve(filters);
  const tradesQ = useTrades(filters);
  const breakdownQ = useBreakdown(dim, filters);
  const accountsQ = useAccounts();
  const currency = accountBaseCurrency(accountsQ.data ?? [], accountId);

  return (
    <ReportsView
      summary={summaryQ.data}
      summaryLoading={summaryQ.isLoading}
      summaryError={summaryQ.isError}
      rSummary={rSummaryQ.data}
      rSummaryLoading={rSummaryQ.isLoading}
      rSummaryError={rSummaryQ.isError}
      trades={tradesQ.data ?? []}
      tradesLoading={tradesQ.isLoading}
      tradesError={tradesQ.isError}
      equity={equityQ.data}
      equityLoading={equityQ.isLoading}
      equityError={equityQ.isError}
      breakdown={breakdownQ.data ?? []}
      loading={breakdownQ.isLoading}
      error={breakdownQ.isError}
      currency={currency}
      dim={dim}
      onDimChange={setDim}
    />
  );
}
```

- [ ] **Step 2: Update `ReportsViewProps` and `SummaryMetricsGrid` in `ReportsView.tsx`**

In `web/src/app/screens/ReportsView.tsx`:

Replace the imports at the top of the file with:

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../../components/Card";
import { ChartFrame, chartTheme } from "../../components/ChartFrame";
import { DataTable } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Page } from "../../components/Page";
import { Skeleton } from "../../components/Skeleton";
import { StatCard } from "../../components/StatCard";
import { pnlColor } from "../../components/theme-tokens";
import { computeDashboardInsights } from "../../lib/dashboardInsights";
import type { BreakGroup, EquityCurve, RSummary, Summary, Trade } from "../../lib/api/types";
import { uniqueDayTicks } from "../../lib/chartTicks";
import { fmtDayShort, fmtDuration, fmtMoney, fmtMoneyCompact, fmtPct, fmtSignedMoney } from "../../lib/format";
import { useMoneyFx } from "../../lib/hooks/useMoneyFx";
import { intlLocale } from "../../lib/locale";
import { usePrivacyMode } from "../../lib/displayPrefs";
```

Replace the entire `SummaryMetricsGrid` function with:

```tsx
function SummaryMetricsGrid({
  summary,
  trades,
  currency,
  fxRate = 1,
}: {
  summary: Summary;
  trades: Trade[];
  currency: string;
  fxRate?: number;
}) {
  usePrivacyMode();
  const locale = intlLocale();
  const insights = computeDashboardInsights(trades);
  const feePct =
    summary.gross_profit + summary.gross_loss !== 0
      ? (summary.total_fees / Math.abs(summary.gross_profit + summary.gross_loss)) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="P&L"
        value={fmtSignedMoney(summary.net_pnl * fxRate, currency, locale)}
        accent={summary.net_pnl >= 0 ? "pos" : "neg"}
        hint={`Gross ${fmtSignedMoney((summary.gross_profit + summary.gross_loss) * fxRate, currency, locale)} · Fees ${fmtMoney(summary.total_fees * fxRate, currency, locale)} (${feePct.toFixed(1)}%)`}
      />
      <StatCard label="Win Rate" value={fmtPct(summary.win_rate, locale)} accent="none" />
      <StatCard
        label="Profit Factor"
        value={summary.profit_factor > 0 ? summary.profit_factor.toFixed(2) : "—"}
      />
      <StatCard label="Total Trades" value={String(summary.total_trades)} />
      <StatCard
        label="Expectancy"
        value={fmtSignedMoney(summary.expectancy * fxRate, currency, locale)}
        accent={summary.expectancy >= 0 ? "pos" : "neg"}
      />
      <StatCard
        label="Avg Win"
        value={fmtMoney(summary.avg_win * fxRate, currency, locale)}
        accent="pos"
      />
      <StatCard
        label="Avg Loss"
        value={fmtMoney(summary.avg_loss * fxRate, currency, locale)}
        accent="neg"
      />
      <StatCard
        label="Largest Win"
        value={fmtMoney(summary.largest_win * fxRate, currency, locale)}
        accent="pos"
      />
      <StatCard
        label="Largest Loss"
        value={fmtMoney(summary.largest_loss * fxRate, currency, locale)}
        accent="neg"
      />
      <StatCard label="Avg Win Hold" value={fmtDuration(insights.winHoldSecs)} accent="pos" />
      <StatCard label="Avg Loss Hold" value={fmtDuration(insights.lossHoldSecs)} accent="neg" />
    </div>
  );
}
```

Replace the `ReportsViewProps` interface with:

```tsx
export interface ReportsViewProps {
  summary?: Summary;
  summaryLoading: boolean;
  summaryError: boolean;
  rSummary?: RSummary;
  rSummaryLoading?: boolean;
  rSummaryError?: boolean;
  trades: Trade[];
  tradesLoading: boolean;
  tradesError: boolean;
  equity?: EquityCurve;
  equityLoading: boolean;
  equityError: boolean;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  dim: BreakdownDim;
  onDimChange: (dim: BreakdownDim) => void;
}
```

In the `ReportsView` function signature, replace the destructured props:

```tsx
export function ReportsView({
  summary,
  summaryLoading,
  summaryError,
  rSummary,
  rSummaryLoading,
  rSummaryError,
  trades,
  tradesLoading,
  tradesError,
  equity,
  equityLoading,
  equityError,
  breakdown,
  loading,
  error,
  currency,
  dim,
  onDimChange,
}: ReportsViewProps) {
```

Delete the `panelRight` `SegmentedControl` for `unit`/`onUnitChange` (keep `DimSelector` for now — Task 11 trims its options) — replace:

```tsx
  const panelRight = (
    <div className="flex items-center gap-2">
      <SegmentedControl
        ariaLabel="Report unit"
        value={unit}
        onChange={(v) => onUnitChange(v as "usd" | "r")}
        options={[
          { value: "usd", label: "$" },
          { value: "r", label: "R" },
        ]}
      />
      <DimSelector value={dim} onChange={onDimChange} />
    </div>
  );
```

with:

```tsx
  const panelRight = <DimSelector value={dim} onChange={onDimChange} />;
```

Remove the `SegmentedControl` import (no longer used in this file — it's still used elsewhere in the codebase, just not here):

```tsx
import { SegmentedControl } from "../../components/SegmentedControl";
```

Delete this line entirely.

In the main return, replace the `SummaryMetricsGrid` call and remove the R-multiple distribution chip block (it moves to a dedicated component in Task 4):

```tsx
      <Card title="Statistics" className="overflow-hidden">
        <SummaryMetricsGrid
          summary={summary}
          currency={displayCurrency}
          fxRate={fxRate}
          unit={unit}
          rSummary={rSummary}
        />
        {unit === "r" && rSummary && rSummary.distribution.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
              R-multiple distribution
            </p>
            <div className="flex flex-wrap gap-2">
              {rSummary.distribution.map((b) => (
                <span
                  key={b.label}
                  className="rounded-sharp border border-border px-2 py-1 text-[11px] text-text-muted"
                >
                  {b.label}: {b.count}
                </span>
              ))}
            </div>
          </div>
        )}
```

becomes:

```tsx
      <Card title="Statistics" className="overflow-hidden">
        <SummaryMetricsGrid summary={summary} trades={trades} currency={displayCurrency} fxRate={fxRate} />
```

Everything else in the file (the `PnlBarChart`, `buildColumns`, `DimSelector`, `ALL_DIMS`/`DIM_LABELS`, the equity curve block, the `Breakdown` card, `renderContent`) stays as-is for this task.

- [ ] **Step 3: Update `ReportsView.test.tsx`'s `base` fixture**

In `web/src/app/screens/ReportsView.test.tsx`, replace:

```tsx
const base = {
  summaryLoading: false,
  summaryError: false,
  equityLoading: false,
  loading: false,
  error: false,
  currency: "USD",
  unit: "usd" as const,
  onUnitChange: vi.fn(),
  onDimChange: vi.fn(),
};
```

with:

```tsx
const base = {
  summaryLoading: false,
  summaryError: false,
  trades: [],
  tradesLoading: false,
  tradesError: false,
  equityLoading: false,
  equityError: false,
  loading: false,
  error: false,
  currency: "USD",
  onDimChange: vi.fn(),
};
```

- [ ] **Step 4: Run the Reports test suite**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx`
Expected: PASS (3 tests — the fixture change doesn't alter any assertions).

- [ ] **Step 5: Typecheck and lint the whole page**

Run: `cd web && vp check`
Expected: PASS. If it fails on an unused `SegmentedControl`/`DimSelector`-related import elsewhere in `ReportsView.tsx`, remove the dangling import — `DimSelector` itself is still used and must stay.

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): fetch trades on Reports, drop \$/R toggle, add hold-time stats"
```

---

### Task 4: R-Multiple Performance + R-Multiple Distribution cards

**Files:**
- Create: `web/src/components/ReportsRMultiplePerformance.tsx`
- Create: `web/src/components/ReportsRDistributionChart.tsx`
- Test: `web/src/components/ReportsRMultiplePerformance.test.tsx`
- Test: `web/src/components/ReportsRDistributionChart.test.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`

**Interfaces:**
- Consumes: `RSummary` (`total_trades`, `excluded`, `avg_r`, `avg_win_r`, `avg_loss_r`, `best_r`, `worst_r`, `distribution: RBucket[]`), `RBucket` (`label`, `count`, `from`, `to`) from `web/src/lib/api/types.ts`.
- Produces: `ReportsRMultiplePerformance({ rSummary?: RSummary; loading: boolean; error: boolean })`; `ReportsRDistributionChart({ distribution: RBucket[]; avgR: number; totalTrades: number; excluded: number; loading: boolean; error: boolean })`.

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsRMultiplePerformance.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { RSummary } from "../lib/api/types";
import { ReportsRMultiplePerformance } from "./ReportsRMultiplePerformance";

function rSummary(over: Partial<RSummary>): RSummary {
  return {
    total_trades: 18,
    wins: 9,
    losses: 6,
    breakeven: 0,
    win_rate: 0.5,
    net_pnl: 98.78,
    gross_profit: 200,
    gross_loss: 101,
    profit_factor: 1.34,
    expectancy: 5.49,
    avg_win: 42.88,
    avg_loss: 31.9,
    avg_trade: 5.49,
    largest_win: 123.69,
    largest_loss: 111.24,
    total_fees: 0,
    excluded: 9,
    avg_r: 1.05,
    avg_win_r: 2.14,
    avg_loss_r: -1.13,
    best_r: 7.12,
    worst_r: -1.91,
    distribution: [],
    ...over,
  };
}

describe("ReportsRMultiplePerformance", () => {
  it("renders the R-multiple stat tiles", () => {
    render(<ReportsRMultiplePerformance rSummary={rSummary({})} loading={false} error={false} />);
    expect(screen.getByText("+1.05R")).toBeInTheDocument();
    expect(screen.getByText("+2.14R")).toBeInTheDocument();
    expect(screen.getByText("-1.13R")).toBeInTheDocument();
  });

  it("shows an empty state with no R-eligible trades", () => {
    render(
      <ReportsRMultiplePerformance
        rSummary={rSummary({ total_trades: 5, excluded: 5 })}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("No R data")).toBeInTheDocument();
  });
});
```

Create `web/src/components/ReportsRDistributionChart.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ReportsRDistributionChart } from "./ReportsRDistributionChart";

describe("ReportsRDistributionChart", () => {
  it("renders bucket labels", () => {
    render(
      <ReportsRDistributionChart
        distribution={[
          { label: "-1 to 0", count: 2, from: -1, to: 0 },
          { label: "0 to +1", count: 4, from: 0, to: 1 },
        ]}
        avgR={1.05}
        totalTrades={18}
        excluded={9}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("-1 to 0")).toBeInTheDocument();
    expect(screen.getByText(/Showing 9 of 18 closed trades/)).toBeInTheDocument();
  });

  it("shows an empty state with no distribution data", () => {
    render(
      <ReportsRDistributionChart
        distribution={[]}
        avgR={0}
        totalTrades={0}
        excluded={0}
        loading={false}
        error={false}
      />,
    );
    expect(screen.getByText("No R data")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsRMultiplePerformance.test.tsx src/components/ReportsRDistributionChart.test.tsx`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement `ReportsRMultiplePerformance.tsx`**

Create `web/src/components/ReportsRMultiplePerformance.tsx`:

```tsx
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";
import type { RSummary } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";

export interface ReportsRMultiplePerformanceProps {
  rSummary?: RSummary;
  loading: boolean;
  error: boolean;
}

function formatR(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function ReportsRMultiplePerformance({
  rSummary,
  loading,
  error,
}: ReportsRMultiplePerformanceProps) {
  usePrivacyMode();
  const included = rSummary ? rSummary.total_trades - rSummary.excluded : 0;

  return (
    <Card title="R-Multiple Performance">
      {loading ? (
        <Skeleton height="100px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load R-multiple performance.</p>
      ) : !rSummary || included <= 0 ? (
        <EmptyState title="No R data" hint="Set stops on your trades to see R-multiples." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Avg R/Trade"
            value={formatR(rSummary.avg_r)}
            accent={rSummary.avg_r >= 0 ? "pos" : "neg"}
            hint={`${included} of ${rSummary.total_trades} trades`}
          />
          <StatCard label="Avg Winning R" value={formatR(rSummary.avg_win_r)} accent="pos" />
          <StatCard label="Avg Losing R" value={formatR(rSummary.avg_loss_r)} accent="neg" />
          <StatCard
            label="Best / Worst R"
            value={`${formatR(rSummary.best_r)} / ${formatR(rSummary.worst_r)}`}
          />
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Implement `ReportsRDistributionChart.tsx`**

Create `web/src/components/ReportsRDistributionChart.tsx`:

```tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import type { RBucket } from "../lib/api/types";

const POS = "var(--color-profit)";
const NEG = "var(--color-loss)";

export interface ReportsRDistributionChartProps {
  distribution: RBucket[];
  avgR: number;
  totalTrades: number;
  excluded: number;
  loading: boolean;
  error: boolean;
}

export function ReportsRDistributionChart({
  distribution,
  avgR,
  totalTrades,
  excluded,
  loading,
  error,
}: ReportsRDistributionChartProps) {
  return (
    <Card
      title="R-Multiple Distribution"
      action={
        !loading && !error && distribution.length > 0 ? (
          <span className="text-[11px] font-medium text-text-muted">
            Avg {avgR >= 0 ? "+" : ""}
            {avgR.toFixed(2)}R
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <Skeleton height="200px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load R-multiple distribution.</p>
      ) : distribution.length === 0 ? (
        <EmptyState title="No R data" hint="Set stops on your trades to see the R distribution." />
      ) : (
        <>
          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distribution} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    color: chartTheme.tooltipText,
                    fontSize: 11,
                  }}
                  formatter={(value) => [String(value), "Trades"]}
                  cursor={{ fill: chartTheme.cursorFill }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {distribution.map((b) => (
                    <Cell key={b.label} fill={b.from < 0 ? NEG : POS} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
          <p className="mt-2 text-[11px] text-text-muted">
            Showing {totalTrades - excluded} of {totalTrades} closed trades
            {excluded > 0 ? `, ${excluded} excluded (no stop)` : ""}
          </p>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsRMultiplePerformance.test.tsx src/components/ReportsRDistributionChart.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire both cards into `ReportsView.tsx`**

Add imports near the top of `web/src/app/screens/ReportsView.tsx`:

```tsx
import { ReportsRDistributionChart } from "../../components/ReportsRDistributionChart";
import { ReportsRMultiplePerformance } from "../../components/ReportsRMultiplePerformance";
```

In the main return, immediately after the closing `</Card>` of the `Statistics` card and before the `Breakdown` card, add:

```tsx
      <ReportsRMultiplePerformance
        rSummary={rSummary}
        loading={Boolean(rSummaryLoading)}
        error={Boolean(rSummaryError)}
      />

      <ReportsRDistributionChart
        distribution={rSummary?.distribution ?? []}
        avgR={rSummary?.avg_r ?? 0}
        totalTrades={rSummary?.total_trades ?? 0}
        excluded={rSummary?.excluded ?? 0}
        loading={Boolean(rSummaryLoading)}
        error={Boolean(rSummaryError)}
      />
```

- [ ] **Step 7: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/ReportsRMultiplePerformance.tsx web/src/components/ReportsRMultiplePerformance.test.tsx web/src/components/ReportsRDistributionChart.tsx web/src/components/ReportsRDistributionChart.test.tsx web/src/app/screens/ReportsView.tsx
git commit -m "feat(web): add R-Multiple Performance and Distribution cards to Reports"
```

---

### Task 5: Rolling Win Rate card

**Files:**
- Create: `web/src/components/ReportsRollingWinRate.tsx`
- Test: `web/src/components/ReportsRollingWinRate.test.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`

**Interfaces:**
- Consumes: `rollingWinRate(trades, windowSize)` from `web/src/lib/reportsAnalytics.ts` (Task 1).
- Produces: `ReportsRollingWinRate({ trades: Trade[]; loading: boolean; error: boolean })`.

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsRollingWinRate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { ReportsRollingWinRate } from "./ReportsRollingWinRate";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("ReportsRollingWinRate", () => {
  it("shows an empty state without enough closed trades for the default window", () => {
    render(<ReportsRollingWinRate trades={[trade({})]} loading={false} error={false} />);
    expect(screen.getByText("Not enough trades")).toBeInTheDocument();
  });

  it("renders the latest rolling win rate once the window fills", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      trade({ id: String(i), closed_at: `2026-07-${String(i + 1).padStart(2, "0")}T12:00:00Z`, net_pnl: i < 5 ? 10 : -10 }),
    );
    render(<ReportsRollingWinRate trades={trades} loading={false} error={false} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsRollingWinRate.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ReportsRollingWinRate.tsx`**

Create `web/src/components/ReportsRollingWinRate.tsx`:

```tsx
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { Trade } from "../lib/api/types";
import { fmtPct } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { rollingWinRate } from "../lib/reportsAnalytics";

const WINDOWS = [10, 20, 50, 100];

export interface ReportsRollingWinRateProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
}

export function ReportsRollingWinRate({ trades, loading, error }: ReportsRollingWinRateProps) {
  const locale = intlLocale();
  const [windowSize, setWindowSize] = useState(20);

  const points = rollingWinRate(trades, windowSize);
  const latest = points.length > 0 ? points[points.length - 1].rate : null;

  const action = (
    <SegmentedControl
      ariaLabel="Rolling window"
      value={String(windowSize)}
      onChange={(v) => setWindowSize(Number(v))}
      options={WINDOWS.map((w) => ({ value: String(w), label: String(w) }))}
    />
  );

  return (
    <Card title="Rolling Win Rate" action={action}>
      {loading ? (
        <Skeleton height="200px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load rolling win rate.</p>
      ) : points.length === 0 ? (
        <EmptyState
          title="Not enough trades"
          hint={`Need at least ${windowSize} closed trades to compute a rolling window.`}
        />
      ) : (
        <>
          <p className="mb-3 text-[43px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-text">
            {fmtPct(latest ?? 0, locale)}
          </p>
          <ChartFrame className="border-0 rounded-none">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                <XAxis
                  dataKey="index"
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                  tickFormatter={(v: number) => fmtPct(v, locale)}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: chartTheme.tooltipBg,
                    border: `1px solid ${chartTheme.tooltipBorder}`,
                    color: chartTheme.tooltipText,
                    fontSize: 11,
                  }}
                  formatter={(value) => [fmtPct(Number(value ?? 0), locale), "Win rate"]}
                  labelFormatter={(v) => `Trade #${v}`}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={chartTheme.accentStroke}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsRollingWinRate.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `ReportsView.tsx`**

Add import:

```tsx
import { ReportsRollingWinRate } from "../../components/ReportsRollingWinRate";
```

In the main return, insert right after the `Statistics` `Card` closes and before `ReportsRMultiplePerformance`:

```tsx
      <ReportsRollingWinRate trades={trades} loading={tradesLoading} error={tradesError} />
```

- [ ] **Step 6: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ReportsRollingWinRate.tsx web/src/components/ReportsRollingWinRate.test.tsx web/src/app/screens/ReportsView.tsx
git commit -m "feat(web): add Rolling Win Rate card to Reports"
```

---

### Task 6: Metric Evolution card

**Files:**
- Create: `web/src/components/ReportsMetricEvolution.tsx`
- Test: `web/src/components/ReportsMetricEvolution.test.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`

**Interfaces:**
- Consumes: `metricEvolution(trades, granularity)`, `EvolutionGranularity`, `EvolutionPoint` from `web/src/lib/reportsAnalytics.ts` (Task 1).
- Produces: `ReportsMetricEvolution({ trades: Trade[]; loading: boolean; error: boolean; currency: string; fxRate?: number })`.

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsMetricEvolution.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Trade } from "../lib/api/types";
import { ReportsMetricEvolution } from "./ReportsMetricEvolution";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("ReportsMetricEvolution", () => {
  it("shows an empty state with no closed trades", () => {
    render(<ReportsMetricEvolution trades={[]} loading={false} error={false} currency="USD" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the granularity and right-axis metric controls once there is data", () => {
    render(
      <ReportsMetricEvolution trades={[trade({})]} loading={false} error={false} currency="USD" />,
    );
    expect(screen.getByRole("tablist", { name: "Evolution granularity" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Right axis metric" })).toBeInTheDocument();
  });
});
```

`SegmentedControl` is built on the Base UI `Tabs` primitive (`web/src/components/Tabs.tsx`), which renders standard ARIA `tablist`/`tab` roles — `TabsList` forwards `aria-label` straight through, matching the `ariaLabel` prop `SegmentedControl` is given.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsMetricEvolution.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ReportsMetricEvolution.tsx`**

Create `web/src/components/ReportsMetricEvolution.tsx`:

```tsx
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { Trade } from "../lib/api/types";
import { fmtDayShort, fmtMoneyCompact, fmtPct } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { type EvolutionGranularity, type EvolutionPoint, metricEvolution } from "../lib/reportsAnalytics";

// "Avg P&L/Trade" is deliberately not offered here: it's algebraically identical
// to "Expectancy" in this cumulative-to-date computation (winRate*avgWin -
// lossRate*avgLoss reduces to cumulativePnl/count for any bucket), so the two
// would always render as the same line. `avgPnlPerTrade` still exists on
// `EvolutionPoint` (lib/reportsAnalytics.ts) but isn't wired to this selector.
type RightMetric = "cumulativePnl" | "profitFactor" | "expectancy";

const RIGHT_METRICS: { value: RightMetric; label: string }[] = [
  { value: "cumulativePnl", label: "Cumulative P&L" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "expectancy", label: "Expectancy" },
];

const GRANULARITIES: { value: EvolutionGranularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export interface ReportsMetricEvolutionProps {
  trades: Trade[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function rightFormatter(metric: RightMetric, currency: string, locale: string) {
  if (metric === "profitFactor") return (v: number) => v.toFixed(2);
  return (v: number) => fmtMoneyCompact(v, currency, locale);
}

export function ReportsMetricEvolution({
  trades,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsMetricEvolutionProps) {
  const locale = intlLocale();
  const [granularity, setGranularity] = useState<EvolutionGranularity>("week");
  const [rightMetric, setRightMetric] = useState<RightMetric>("cumulativePnl");

  const rawPoints = metricEvolution(trades, granularity);
  const points: EvolutionPoint[] = rawPoints.map((p) => ({
    ...p,
    cumulativePnl: p.cumulativePnl * fxRate,
    expectancy: p.expectancy * fxRate,
  }));
  const fmtRight = rightFormatter(rightMetric, currency, locale);
  const rightLabel = RIGHT_METRICS.find((m) => m.value === rightMetric)?.label ?? "";
  const lastRightValue = points.length > 0 ? points[points.length - 1][rightMetric] : 0;
  const rightColor = lastRightValue < 0 ? "var(--color-loss)" : "var(--color-profit)";

  const action = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        ariaLabel="Evolution granularity"
        value={granularity}
        onChange={(v) => setGranularity(v as EvolutionGranularity)}
        options={GRANULARITIES}
      />
      <SegmentedControl
        ariaLabel="Right axis metric"
        value={rightMetric}
        onChange={(v) => setRightMetric(v as RightMetric)}
        options={RIGHT_METRICS}
      />
    </div>
  );

  return (
    <Card title="Metric Evolution" action={action}>
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load metric evolution.</p>
      ) : points.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see trends over time." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
              <XAxis
                dataKey="bucket"
                tickFormatter={(v: string) => fmtDayShort(v, locale)}
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                tickFormatter={(v: number) => fmtPct(v, locale)}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={[0, 1]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                tickFormatter={fmtRight}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                labelFormatter={(v) => fmtDayShort(String(v), locale)}
                formatter={(value, name) => [
                  name === "winRate" ? fmtPct(Number(value ?? 0), locale) : fmtRight(Number(value ?? 0)),
                  name === "winRate" ? "Win rate" : rightLabel,
                ]}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="winRate"
                name="winRate"
                stroke={chartTheme.accentStroke}
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={rightMetric}
                name={rightMetric}
                stroke={rightColor}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsMetricEvolution.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `ReportsView.tsx`**

Add import:

```tsx
import { ReportsMetricEvolution } from "../../components/ReportsMetricEvolution";
```

In the main return, insert right after `ReportsRollingWinRate`:

```tsx
      <ReportsMetricEvolution
        trades={trades}
        loading={tradesLoading}
        error={tradesError}
        currency={displayCurrency}
        fxRate={fxRate}
      />
```

- [ ] **Step 6: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ReportsMetricEvolution.tsx web/src/components/ReportsMetricEvolution.test.tsx web/src/app/screens/ReportsView.tsx
git commit -m "feat(web): add Metric Evolution card to Reports"
```

---

### Task 7: Generic breakdown card (chart mode) + Day of Week / Time of Day

**Files:**
- Create: `web/src/components/ReportsBreakdownCard.tsx`
- Test: `web/src/components/ReportsBreakdownCard.test.tsx`
- Modify: `web/src/routes/reports.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `BreakGroup` from `web/src/lib/api/types.ts`; `useBreakdown(by, filters)` from `web/src/lib/hooks/useAnalytics.ts`.
- Produces: `ReportsBreakdownCard({ title: string; breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number; orientation?: "horizontal" | "vertical"; tableColumns?: ColumnDef<BreakGroup>[] })`. `ReportsViewProps` gains `dayOfWeekBreakdown/-Loading/-Error` and `hourOfDayBreakdown/-Loading/-Error` (all `BreakGroup[]`/`boolean`/`boolean`).

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsBreakdownCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsBreakdownCard } from "./ReportsBreakdownCard";

function grp(key: string, net: number): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 1,
      wins: net >= 0 ? 1 : 0,
      losses: net < 0 ? 1 : 0,
      breakeven: 0,
      win_rate: net >= 0 ? 1 : 0,
      net_pnl: net,
      gross_profit: net > 0 ? net : 0,
      gross_loss: net < 0 ? -net : 0,
      profit_factor: 0,
      expectancy: net,
      avg_win: 0,
      avg_loss: 0,
      avg_trade: net,
      largest_win: 0,
      largest_loss: 0,
      total_fees: 0,
    },
  };
}

describe("ReportsBreakdownCard", () => {
  it("shows an empty state with no data", () => {
    render(
      <ReportsBreakdownCard title="Day of Week" breakdown={[]} loading={false} error={false} currency="USD" />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders the card title", () => {
    render(
      <ReportsBreakdownCard
        title="Day of Week"
        breakdown={[grp("Monday", 200), grp("Tuesday", -50)]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("Day of Week")).toBeInTheDocument();
  });

  it("does not render a Chart/Table toggle without tableColumns", () => {
    render(
      <ReportsBreakdownCard
        title="Day of Week"
        breakdown={[grp("Monday", 200)]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.queryByText("Table")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsBreakdownCard.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ReportsBreakdownCard.tsx` (chart mode only for now — table mode added in Task 8)**

Create `web/src/components/ReportsBreakdownCard.tsx`:

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { SegmentedControl } from "./SegmentedControl";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

const POS = "var(--color-profit)";
const NEG = "var(--color-loss)";

export interface ReportsBreakdownCardProps {
  title: string;
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
  orientation?: "horizontal" | "vertical";
  tableColumns?: ColumnDef<BreakGroup>[];
}

export function ReportsBreakdownCard({
  title,
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
  orientation = "vertical",
  tableColumns,
}: ReportsBreakdownCardProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const [view, setView] = useState<"chart" | "table">("chart");
  const horizontal = orientation === "horizontal";

  const action = tableColumns ? (
    <SegmentedControl
      ariaLabel={`${title} view`}
      value={view}
      onChange={(v) => setView(v as "chart" | "table")}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
    />
  ) : undefined;

  return (
    <Card title={title} action={action}>
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load {title.toLowerCase()}.</p>
      ) : breakdown.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see a breakdown." />
      ) : view === "table" && tableColumns ? (
        <div style={{ maxHeight: 280 }}>
          <DataTable columns={tableColumns} data={breakdown} />
        </div>
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={breakdown.map((g) => ({ key: g.key, net_pnl: g.summary.net_pnl * fxRate }))}
              layout={horizontal ? "vertical" : "horizontal"}
              margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 8 : 0 }}
            >
              <CartesianGrid
                horizontal={!horizontal}
                vertical={horizontal}
                stroke={chartTheme.gridColor}
              />
              {horizontal ? (
                <>
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="key"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="key"
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => fmtMoneyCompact(v, currency, locale)}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                </>
              )}
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                formatter={(value) => [
                  fmtSignedMoney(Number(value ?? 0), currency, locale),
                  "Net P&L",
                ]}
                cursor={{ fill: chartTheme.cursorFill }}
              />
              <Bar dataKey="net_pnl" radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}>
                {breakdown.map((g) => (
                  <Cell key={g.key} fill={g.summary.net_pnl >= 0 ? POS : NEG} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsBreakdownCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add Day of Week / Time of Day breakdown queries to the route**

In `web/src/routes/reports.tsx`, add two more `useBreakdown` calls and pass their results down. Add to the imports (already importing `useBreakdown`, no import change needed), then inside `ReportsPage`:

```tsx
  const dayOfWeekBreakdownQ = useBreakdown("day_of_week", filters);
  const hourOfDayBreakdownQ = useBreakdown("hour_of_day", filters);
```

Add to the `<ReportsView ... />` props:

```tsx
      dayOfWeekBreakdown={dayOfWeekBreakdownQ.data ?? []}
      dayOfWeekBreakdownLoading={dayOfWeekBreakdownQ.isLoading}
      dayOfWeekBreakdownError={dayOfWeekBreakdownQ.isError}
      hourOfDayBreakdown={hourOfDayBreakdownQ.data ?? []}
      hourOfDayBreakdownLoading={hourOfDayBreakdownQ.isLoading}
      hourOfDayBreakdownError={hourOfDayBreakdownQ.isError}
```

- [ ] **Step 6: Add the new props to `ReportsViewProps` and wire the cards**

In `web/src/app/screens/ReportsView.tsx`, add to `ReportsViewProps`:

```tsx
  dayOfWeekBreakdown: BreakGroup[];
  dayOfWeekBreakdownLoading: boolean;
  dayOfWeekBreakdownError: boolean;
  hourOfDayBreakdown: BreakGroup[];
  hourOfDayBreakdownLoading: boolean;
  hourOfDayBreakdownError: boolean;
```

Add the same names to the destructured function parameters, and add the import:

```tsx
import { ReportsBreakdownCard } from "../../components/ReportsBreakdownCard";
```

In the main return, insert right after `ReportsRDistributionChart` and before the `Breakdown` card:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportsBreakdownCard
          title="Day of Week"
          breakdown={dayOfWeekBreakdown}
          loading={dayOfWeekBreakdownLoading}
          error={dayOfWeekBreakdownError}
          currency={displayCurrency}
          fxRate={fxRate}
        />
        <ReportsBreakdownCard
          title="Time of Day"
          breakdown={hourOfDayBreakdown}
          loading={hourOfDayBreakdownLoading}
          error={hourOfDayBreakdownError}
          currency={displayCurrency}
          fxRate={fxRate}
        />
      </div>
```

- [ ] **Step 7: Update `ReportsView.test.tsx`'s `base` fixture**

Add to the `base` object in `web/src/app/screens/ReportsView.test.tsx`:

```tsx
  dayOfWeekBreakdown: [],
  dayOfWeekBreakdownLoading: false,
  dayOfWeekBreakdownError: false,
  hourOfDayBreakdown: [],
  hourOfDayBreakdownLoading: false,
  hourOfDayBreakdownError: false,
```

- [ ] **Step 8: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx src/components/ReportsBreakdownCard.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ReportsBreakdownCard.tsx web/src/components/ReportsBreakdownCard.test.tsx web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): add Day of Week and Time of Day breakdown cards to Reports"
```

---

### Task 8: Breakdown card table mode + Symbol / Tag cards

**Files:**
- Modify: `web/src/components/ReportsBreakdownCard.test.tsx`
- Modify: `web/src/routes/reports.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `buildColumns(currency: string, dimLabel: string, fxRate?: number): ColumnDef<BreakGroup>[]` — already defined in `ReportsView.tsx`, exported in this task.
- Produces: `ReportsViewProps` gains `symbolBreakdown/-Loading/-Error` and `tagBreakdown/-Loading/-Error` (all `BreakGroup[]`/`boolean`/`boolean`).

- [ ] **Step 1: Write a failing test for table-toggle mode**

Add to `web/src/components/ReportsBreakdownCard.test.tsx` (needs `buildColumns`-shaped columns; define a small local column set inline rather than importing from `ReportsView` to keep this test file independent). Update the top-of-file imports to:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsBreakdownCard } from "./ReportsBreakdownCard";

// Mock DataTable (virtualizer needs a sized container in jsdom) — same pattern as ReportsView.test.tsx.
vi.mock("./DataTable", () => ({
  DataTable: ({ data }: { data: BreakGroup[] }) => (
    <div data-testid="table">
      {data.map((g) => (
        <div key={g.key}>{g.key}</div>
      ))}
    </div>
  ),
}));
```

Then append at the end of the file:

```tsx
const testColumns: ColumnDef<BreakGroup>[] = [
  { accessorKey: "key", header: "Symbol", cell: (info) => info.getValue<string>() },
];

describe("ReportsBreakdownCard table toggle", () => {
  it("renders a Chart/Table toggle and switches views when tableColumns is provided", async () => {
    const user = userEvent.setup();
    render(
      <ReportsBreakdownCard
        title="Symbol"
        breakdown={[grp("AAPL", 200)]}
        loading={false}
        error={false}
        currency="USD"
        tableColumns={testColumns}
      />,
    );
    expect(screen.getByText("Table")).toBeInTheDocument();
    await user.click(screen.getByText("Table"));
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web && vp test src/components/ReportsBreakdownCard.test.tsx`
Expected: FAIL — the `vi.mock("./DataTable", ...)` call added in this step didn't exist when Task 7's tests ran, and Vitest hoists `vi.mock` to the top of the file, so re-run confirms whether the new test's assertions hold with the mock in place; if the toggle/table-switch assertions fail, that's real signal for Step 3.

- [ ] **Step 3: Fix the implementation if the test fails for a real reason, otherwise confirm it passes as-is**

The `ReportsBreakdownCard` component from Task 7 already implements the toggle and table rendering, so this test is expected to pass once the mock and import are in place — Step 2's "FAIL" is about confirming the test actually exercises the toggle (not a trivially-true assertion), not about missing implementation. If it passes immediately in Step 2, that's fine — proceed to Step 4. If it fails for a real reason (e.g. the toggle button text doesn't match, or `view` state doesn't switch), fix `ReportsBreakdownCard.tsx`'s `view` state / `SegmentedControl` wiring to match.

Run: `cd web && vp test src/components/ReportsBreakdownCard.test.tsx`
Expected: PASS (4 tests: the 3 from Task 7 plus this one).

- [ ] **Step 4: Export `buildColumns` from `ReportsView.tsx`**

In `web/src/app/screens/ReportsView.tsx`, change:

```tsx
function buildColumns(currency: string, dimLabel: string, fxRate = 1): ColumnDef<BreakGroup>[] {
```

to:

```tsx
export function buildColumns(currency: string, dimLabel: string, fxRate = 1): ColumnDef<BreakGroup>[] {
```

- [ ] **Step 5: Add Symbol / Tag breakdown queries to the route**

In `web/src/routes/reports.tsx`, add:

```tsx
  const symbolBreakdownQ = useBreakdown("symbol", filters);
  const tagBreakdownQ = useBreakdown("tag", filters);
```

Add to the `<ReportsView ... />` props:

```tsx
      symbolBreakdown={symbolBreakdownQ.data ?? []}
      symbolBreakdownLoading={symbolBreakdownQ.isLoading}
      symbolBreakdownError={symbolBreakdownQ.isError}
      tagBreakdown={tagBreakdownQ.data ?? []}
      tagBreakdownLoading={tagBreakdownQ.isLoading}
      tagBreakdownError={tagBreakdownQ.isError}
```

- [ ] **Step 6: Add the new props and wire the cards in `ReportsView.tsx`**

Add to `ReportsViewProps`:

```tsx
  symbolBreakdown: BreakGroup[];
  symbolBreakdownLoading: boolean;
  symbolBreakdownError: boolean;
  tagBreakdown: BreakGroup[];
  tagBreakdownLoading: boolean;
  tagBreakdownError: boolean;
```

Add the same names to the destructured function parameters.

In the main return, insert right after `ReportsRDistributionChart` and **before** the Day of Week / Time of Day grid added in Task 7:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportsBreakdownCard
          title="Symbol"
          breakdown={symbolBreakdown}
          loading={symbolBreakdownLoading}
          error={symbolBreakdownError}
          currency={displayCurrency}
          fxRate={fxRate}
          orientation="horizontal"
          tableColumns={buildColumns(displayCurrency, "Symbol", fxRate)}
        />
        <ReportsBreakdownCard
          title="Tag"
          breakdown={tagBreakdown}
          loading={tagBreakdownLoading}
          error={tagBreakdownError}
          currency={displayCurrency}
          fxRate={fxRate}
          orientation="horizontal"
          tableColumns={buildColumns(displayCurrency, "Tag", fxRate)}
        />
      </div>
```

- [ ] **Step 7: Update `ReportsView.test.tsx`'s `base` fixture**

Add to `base`:

```tsx
  symbolBreakdown: [],
  symbolBreakdownLoading: false,
  symbolBreakdownError: false,
  tagBreakdown: [],
  tagBreakdownLoading: false,
  tagBreakdownError: false,
```

- [ ] **Step 8: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx src/components/ReportsBreakdownCard.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ReportsBreakdownCard.test.tsx web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): add Symbol and Tag breakdown cards with Chart/Table toggle"
```

---

### Task 9: Session Performance table

**Files:**
- Create: `web/src/components/ReportsSessionTable.tsx`
- Test: `web/src/components/ReportsSessionTable.test.tsx`
- Modify: `web/src/routes/reports.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `BreakGroup` (session dim) from the existing `/analytics/breakdown` endpoint via `useBreakdown("session", filters)`.
- Produces: `ReportsSessionTable({ breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number })`. `ReportsViewProps` gains `sessionBreakdown/-Loading/-Error`.

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsSessionTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsSessionTable } from "./ReportsSessionTable";

vi.mock("./DataTable", () => ({
  DataTable: ({ data }: { data: BreakGroup[] }) => (
    <div data-testid="table">
      {data.map((g) => (
        <div key={g.key}>
          {g.key} {g.summary.total_trades}
        </div>
      ))}
    </div>
  ),
}));

function grp(key: string): BreakGroup {
  return {
    key,
    summary: {
      total_trades: 18,
      wins: 9,
      losses: 9,
      breakeven: 0,
      win_rate: 0.5,
      net_pnl: 98.78,
      gross_profit: 200,
      gross_loss: 101,
      profit_factor: 1.34,
      expectancy: 5.49,
      avg_win: 42.88,
      avg_loss: 31.9,
      avg_trade: 5.49,
      largest_win: 123.69,
      largest_loss: 111.24,
      total_fees: 0,
    },
  };
}

describe("ReportsSessionTable", () => {
  it("shows an empty state with no data", () => {
    render(<ReportsSessionTable breakdown={[]} loading={false} error={false} currency="USD" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders session rows", () => {
    render(
      <ReportsSessionTable
        breakdown={[grp("Unsessioned")]}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText(/Unsessioned/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsSessionTable.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ReportsSessionTable.tsx`**

Create `web/src/components/ReportsSessionTable.tsx`:

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Card } from "./Card";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtPct, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

export interface ReportsSessionTableProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function buildSessionColumns(
  currency: string,
  locale: string,
  fxRate: number,
): ColumnDef<BreakGroup>[] {
  return [
    {
      accessorKey: "key",
      header: "Session",
      cell: (info) => <span className="font-medium text-text">{info.getValue<string>()}</span>,
    },
    {
      id: "total_trades",
      accessorFn: (row) => row.summary.total_trades,
      header: "Trades",
      cell: (info) => (
        <span className="tabular-nums text-text-muted">{info.getValue<number>()}</span>
      ),
    },
    {
      id: "win_rate",
      accessorFn: (row) => row.summary.win_rate,
      header: "Win %",
      cell: (info) => (
        <span className="tabular-nums text-text">{fmtPct(info.getValue<number>(), locale)}</span>
      ),
    },
    {
      id: "net_pnl",
      accessorFn: (row) => row.summary.net_pnl,
      header: "Net P&L",
      cell: (info) => {
        const v = info.getValue<number>();
        return (
          <span className={`tabular-nums ${pnlColor(v)}`}>
            {fmtSignedMoney(v * fxRate, currency, locale)}
          </span>
        );
      },
    },
    {
      id: "avg_trade",
      accessorFn: (row) => row.summary.avg_trade,
      header: "Avg/Trade",
      cell: (info) => {
        const v = info.getValue<number>();
        return (
          <span className={`tabular-nums ${pnlColor(v)}`}>
            {fmtSignedMoney(v * fxRate, currency, locale)}
          </span>
        );
      },
    },
  ];
}

export function ReportsSessionTable({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsSessionTableProps) {
  usePrivacyMode();
  const locale = intlLocale();

  return (
    <Card title="Session Performance">
      {loading ? (
        <Skeleton height="160px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load session performance.</p>
      ) : breakdown.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see session performance." />
      ) : (
        <div style={{ maxHeight: 240 }}>
          <DataTable columns={buildSessionColumns(currency, locale, fxRate)} data={breakdown} />
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsSessionTable.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add session breakdown query to the route**

In `web/src/routes/reports.tsx`, add:

```tsx
  const sessionBreakdownQ = useBreakdown("session", filters);
```

Add to `<ReportsView ... />` props:

```tsx
      sessionBreakdown={sessionBreakdownQ.data ?? []}
      sessionBreakdownLoading={sessionBreakdownQ.isLoading}
      sessionBreakdownError={sessionBreakdownQ.isError}
```

- [ ] **Step 6: Add the new props and wire the card in `ReportsView.tsx`**

Add to `ReportsViewProps`:

```tsx
  sessionBreakdown: BreakGroup[];
  sessionBreakdownLoading: boolean;
  sessionBreakdownError: boolean;
```

Add the same names to the destructured function parameters and the import:

```tsx
import { ReportsSessionTable } from "../../components/ReportsSessionTable";
```

In the main return, insert right after the Day of Week / Time of Day grid (Task 7) and before the `Breakdown` card:

```tsx
      <ReportsSessionTable
        breakdown={sessionBreakdown}
        loading={sessionBreakdownLoading}
        error={sessionBreakdownError}
        currency={displayCurrency}
        fxRate={fxRate}
      />
```

- [ ] **Step 7: Update `ReportsView.test.tsx`'s `base` fixture**

Add to `base`:

```tsx
  sessionBreakdown: [],
  sessionBreakdownLoading: false,
  sessionBreakdownError: false,
```

- [ ] **Step 8: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx src/components/ReportsSessionTable.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/ReportsSessionTable.tsx web/src/components/ReportsSessionTable.test.tsx web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): add Session Performance table to Reports"
```

---

### Task 10: Risk & Drawdown card

**Files:**
- Create: `web/src/components/ReportsRiskDrawdown.tsx`
- Test: `web/src/components/ReportsRiskDrawdown.test.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `computeDashboardInsights(trades)` (`.winHoldSecs`/`.lossHoldSecs`/`.worstStreak`) from `web/src/lib/dashboardInsights.ts`; `avgRiskPerTrade`, `drawdownSeries`, `currentDrawdownPct`, `maxDrawdownPct` from `web/src/lib/reportsAnalytics.ts` (Task 2).
- Produces: `ReportsRiskDrawdown({ trades: Trade[]; equityPoints: EquityPoint[]; loading: boolean; error: boolean; currency: string; fxRate?: number })`.

- [ ] **Step 1: Write failing tests**

Create `web/src/components/ReportsRiskDrawdown.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { EquityPoint, Trade } from "../lib/api/types";
import { ReportsRiskDrawdown } from "./ReportsRiskDrawdown";

function trade(over: Partial<Trade>): Trade {
  return {
    id: "t1",
    account_id: "a1",
    symbol: "NQ",
    instrument_type: "future",
    direction: "long",
    status: "closed",
    opened_at: "2026-07-01T10:00:00Z",
    closed_at: "2026-07-01T11:00:00Z",
    qty_opened: 1,
    qty_remaining: 0,
    avg_entry_price: 100,
    avg_exit_price: 110,
    gross_pnl: 10,
    fees_total: 0,
    net_pnl: 10,
    pnl_currency: "USD",
    return_pct: 0.1,
    time_in_trade_secs: 3600,
    notes: "",
    tags: [],
    ...over,
  };
}

describe("ReportsRiskDrawdown", () => {
  it("shows an empty state with no equity points", () => {
    render(
      <ReportsRiskDrawdown trades={[]} equityPoints={[]} loading={false} error={false} currency="USD" />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("renders drawdown and risk stat tiles", () => {
    const points: EquityPoint[] = [
      { at: "2026-07-01T00:00:00Z", equity: 1000 },
      { at: "2026-07-02T00:00:00Z", equity: 900 },
    ];
    render(
      <ReportsRiskDrawdown
        trades={[trade({ initial_risk: 100 }), trade({ id: "t2", initial_risk: 200 })]}
        equityPoints={points}
        loading={false}
        error={false}
        currency="USD"
      />,
    );
    expect(screen.getByText("Max Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Current Drawdown")).toBeInTheDocument();
    expect(screen.getByText("Longest Losing Streak")).toBeInTheDocument();
    expect(screen.getByText("Avg Risk/Trade")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/ReportsRiskDrawdown.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ReportsRiskDrawdown.tsx`**

Create `web/src/components/ReportsRiskDrawdown.tsx`:

```tsx
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { StatCard } from "./StatCard";
import type { EquityPoint, Trade } from "../lib/api/types";
import { uniqueDayTicks } from "../lib/chartTicks";
import { computeDashboardInsights } from "../lib/dashboardInsights";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtDayShort, fmtMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import {
  avgRiskPerTrade,
  currentDrawdownPct,
  drawdownSeries,
  maxDrawdownPct,
} from "../lib/reportsAnalytics";

export interface ReportsRiskDrawdownProps {
  trades: Trade[];
  equityPoints: EquityPoint[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

function fmtDrawdownPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

export function ReportsRiskDrawdown({
  trades,
  equityPoints,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsRiskDrawdownProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const insights = computeDashboardInsights(trades);
  const risk = avgRiskPerTrade(trades);
  const series = drawdownSeries(equityPoints);
  const maxDd = maxDrawdownPct(equityPoints);
  const currentDd = currentDrawdownPct(equityPoints);

  return (
    <Card title="Risk & Drawdown">
      {loading ? (
        <Skeleton height="240px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load risk &amp; drawdown.</p>
      ) : equityPoints.length === 0 ? (
        <EmptyState title="No data" hint="Add trades to see risk and drawdown stats." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Max Drawdown" value={fmtDrawdownPct(maxDd)} accent="neg" />
            <StatCard
              label="Current Drawdown"
              value={fmtDrawdownPct(currentDd)}
              accent={currentDd < 0 ? "neg" : "none"}
            />
            <StatCard
              label="Longest Losing Streak"
              value={insights.worstStreak > 0 ? `${insights.worstStreak} trades` : "—"}
            />
            <StatCard
              label="Avg Risk/Trade"
              value={risk.avg != null ? fmtMoney(risk.avg * fxRate, currency, locale) : "—"}
              hint={
                risk.avg != null ? `${risk.included} of ${risk.included + risk.excluded} trades` : undefined
              }
            />
          </div>
          <div className="mt-4">
            <ChartFrame className="border-0 rounded-none">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-loss)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-loss)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                  <XAxis
                    dataKey="at"
                    ticks={uniqueDayTicks(series)}
                    tickFormatter={(v: string) => fmtDayShort(v, locale)}
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartTheme.axisColor }}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={["auto", 0]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: chartTheme.tooltipBg,
                      border: `1px solid ${chartTheme.tooltipBorder}`,
                      color: chartTheme.tooltipText,
                      fontSize: 11,
                    }}
                    formatter={(value) => [fmtDrawdownPct(Number(value ?? 0)), "Drawdown"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="drawdownPct"
                    stroke="var(--color-loss)"
                    strokeWidth={1.5}
                    fill="url(#dd-fill)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/ReportsRiskDrawdown.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `ReportsView.tsx`**

Add import:

```tsx
import { ReportsRiskDrawdown } from "../../components/ReportsRiskDrawdown";
```

In the main return, insert right after `ReportsSessionTable` and before the `Breakdown` card:

```tsx
      <ReportsRiskDrawdown
        trades={trades}
        equityPoints={equity?.points ?? []}
        loading={tradesLoading || equityLoading}
        error={tradesError || equityError}
        currency={displayCurrency}
        fxRate={fxRate}
      />
```

- [ ] **Step 6: Run the full page test and typecheck**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx && vp check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ReportsRiskDrawdown.tsx web/src/components/ReportsRiskDrawdown.test.tsx web/src/app/screens/ReportsView.tsx
git commit -m "feat(web): add Risk & Drawdown card to Reports"
```

---

### Task 11: Trim the Breakdown selector to Setup/Mistake and verify the full page

**Files:**
- Modify: `web/src/app/screens/ReportsView.tsx`
- Modify: `web/src/app/screens/ReportsView.test.tsx`
- Modify: `web/e2e/smoke.spec.ts` (verify only — update if it breaks)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ALL_DIMS` in `ReportsView.tsx` is replaced by `SELECTOR_DIMS: BreakdownDim[] = ["setup", "mistake"]`, used only by `DimSelector`. `DIM_LABELS` (all 7 dims) stays as-is since it's still referenced by `buildColumns`.

- [ ] **Step 1: Trim the dim selector**

In `web/src/app/screens/ReportsView.tsx`, replace:

```tsx
const ALL_DIMS: BreakdownDim[] = [
  "symbol",
  "setup",
  "session",
  "day_of_week",
  "hour_of_day",
  "tag",
  "mistake",
];
```

with:

```tsx
// Symbol, Tag, Day of Week, Time of Day, and Session each have their own
// always-visible card above; this selector only covers the two dims without one.
const SELECTOR_DIMS: BreakdownDim[] = ["setup", "mistake"];
```

In the `DimSelector` component, replace the `ALL_DIMS.map` with `SELECTOR_DIMS.map`:

```tsx
      {ALL_DIMS.map((d) => {
```

becomes:

```tsx
      {SELECTOR_DIMS.map((d) => {
```

- [ ] **Step 2: Confirm the route's default `dim` is already `"setup"`**

`web/src/routes/reports.tsx` was already changed to `useState<BreakdownDim>("setup")` in Task 3 — no further change needed. Read the file to confirm before moving on.

- [ ] **Step 3: Run the full Reports test suite**

Run: `cd web && vp test src/app/screens/ReportsView.test.tsx src/lib/reportsAnalytics.test.ts src/lib/dashboardInsights.test.ts src/components/ReportsRMultiplePerformance.test.tsx src/components/ReportsRDistributionChart.test.tsx src/components/ReportsRollingWinRate.test.tsx src/components/ReportsMetricEvolution.test.tsx src/components/ReportsBreakdownCard.test.tsx src/components/ReportsSessionTable.test.tsx src/components/ReportsRiskDrawdown.test.tsx`
Expected: PASS across all files.

- [ ] **Step 4: Full typecheck/lint/format pass**

Run: `cd web && vp check`
Expected: PASS.

- [ ] **Step 5: Run the e2e smoke test**

Run: `cd web && pnpm e2e e2e/smoke.spec.ts` (this runs `playwright test`, per the `"e2e"` script in `web/package.json`; requires the dev server and a seeded DB per `web/e2e/smoke.spec.ts`'s login flow).
Expected: PASS. The smoke test asserts `"Statistics"` and `"Profit Factor"` (via `.first()`) are visible on `/reports` — both still render from the unchanged Statistics card, so it should pass unmodified. If it fails because `.first()` now resolves ambiguously across more "Profit Factor" occurrences (Statistics grid, R-Multiple Performance tile, Setup/Mistake breakdown table, Symbol/Tag table-mode columns), that's expected — `.first()` already handles multiple matches; only fix the test if the assertion target changed meaning, not just count.

- [ ] **Step 6: Manually verify the page in the browser**

Run: `cd web && vp dev`, then open `/reports` in a browser (log in with a seeded account that has trades — see the `E2E needs seeded trades` note in project memory if the dev DB is empty). Confirm, top to bottom: Statistics (11 tiles, no $/R toggle) → Rolling Win Rate → Metric Evolution → R-Multiple Performance → R-Multiple Distribution → Symbol/Tag (2-col, Chart/Table toggle) → Day of Week/Time of Day (2-col) → Session Performance → Risk & Drawdown → Breakdown (Setup/Mistake selector only). Confirm no console errors and no layout overflow at both desktop and narrow widths.

- [ ] **Step 7: Commit**

```bash
git add web/src/app/screens/ReportsView.tsx
git commit -m "feat(web): trim Breakdown selector to Setup/Mistake now that other dims have dedicated cards"
```

---

## Post-plan cleanup

After all 11 tasks: re-read the full `web/src/app/screens/ReportsView.tsx` top to bottom to confirm import order/grouping is clean (no leftover unused imports from the incremental edits), then run `cd web && vp check --fix` once to normalize formatting across every file touched in this plan, and commit any resulting formatting-only diff separately if non-empty.
