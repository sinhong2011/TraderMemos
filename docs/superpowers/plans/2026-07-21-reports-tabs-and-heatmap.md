# Reports Tabs + Stock P&L Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organize the Reports page into four URL-addressable tabs (Overview / Win-Loss / Detailed / Risk) and add a stock P&L treemap heatmap card to the Detailed tab.

**Architecture:** A new presentational `ReportsSymbolHeatmap` component renders a recharts `Treemap` from the existing `symbolBreakdown` data (tile area = trade count, color = net P&L). `ReportsView` wraps its existing sections in the app's Base-UI `Tabs` primitives, grouping them into four panels; the KPI grid moves into the Overview panel and the heatmap into the Detailed panel. The `/reports` route validates a `tab` search param and drives it via `useNavigate`, passing `tab`/`onTabChange` into `ReportsView` (mirroring the existing `dim`/`onDimChange` pattern).

**Tech Stack:** React + TypeScript, TanStack Router, Base-UI Tabs, recharts 3.9.2, vite-plus/test, Testing Library.

## Global Constraints

- Package manager is **bun**: `bun run test <name>` for focused tests, `bun run lint` for typecheck+lint. NOT npm.
- Reuse existing tokens/helpers only: `pnlColor`/`chartTheme`, `fmtMoneyCompact`/`fmtSignedMoney`, `Card`/`Skeleton`/`EmptyState`/`ChartFrame`, `intlLocale`, `usePrivacyMode`, and the `Tabs`/`TabsList`/`TabsTrigger`/`TabsIndicator`/`TabsContent` primitives from `web/src/components/Tabs.tsx`. No new tokens or dependencies.
- Tab values are exactly `"overview" | "win-loss" | "detailed" | "risk"`; default is `overview`; an unknown `?tab=` coerces to `overview`.
- Section→tab mapping (exact): Overview = KPI grid + Playbook & Leaks + R-Multiple + Execution Grade; Win-Loss = Rolling Win-Rate + Metric Evolution; Detailed = Symbol + Tag + Day of Week + Hour + Session + Stock P&L heatmap; Risk = Risk/Drawdown.
- The heatmap consumes the existing `symbolBreakdown` prop already passed to `ReportsView` — no new route query or prop for its data.
- Base-UI `Tabs.Panel` unmounts inactive panels (default `keepMounted=false`), so only the active tab's cards are in the DOM.

---

### Task 1: `ReportsSymbolHeatmap` component

**Files:**
- Create: `web/src/components/ReportsSymbolHeatmap.tsx`
- Test: `web/src/components/ReportsSymbolHeatmap.test.tsx`

**Interfaces:**
- Consumes: `BreakGroup` (`../lib/api/types`); `Card`/`Skeleton`/`EmptyState`/`ChartFrame`(+`chartTheme`); `fmtMoneyCompact`/`fmtSignedMoney` (`../lib/format`); `intlLocale`; `usePrivacyMode`; recharts `Treemap`/`ResponsiveContainer`/`Tooltip`.
- Produces: `export function ReportsSymbolHeatmap(props: ReportsSymbolHeatmapProps)`, `export interface ReportsSymbolHeatmapProps { breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number }`, and two pure helpers `export function buildHeatmapNodes(breakdown: BreakGroup[]): HeatmapNode[]` and `export function tileStyle(netPnl: number, maxAbs: number): { fill: string; fillOpacity: number }` with `export interface HeatmapNode { name: string; size: number; netPnl: number }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/ReportsSymbolHeatmap.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsSymbolHeatmap, buildHeatmapNodes, tileStyle } from "./ReportsSymbolHeatmap";

function grp(key: string, net: number, trades: number): BreakGroup {
  return {
    key,
    summary: {
      total_trades: trades,
      wins: net >= 0 ? trades : 0,
      losses: net < 0 ? trades : 0,
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
  } as BreakGroup;
}

const props = { loading: false, error: false, currency: "USD" };

describe("buildHeatmapNodes", () => {
  it("maps symbols to nodes with size=trade count and netPnl", () => {
    expect(buildHeatmapNodes([grp("AAPL", 200, 3), grp("TSLA", -100, 2)])).toEqual([
      { name: "AAPL", size: 3, netPnl: 200 },
      { name: "TSLA", size: 2, netPnl: -100 },
    ]);
  });

  it("excludes symbols with zero trades", () => {
    expect(buildHeatmapNodes([grp("AAPL", 200, 3), grp("MSFT", 0, 0)]).map((n) => n.name)).toEqual([
      "AAPL",
    ]);
  });
});

describe("tileStyle", () => {
  it("colors profit green and loss rose", () => {
    expect(tileStyle(50, 100).fill).toBe("var(--color-profit)");
    expect(tileStyle(-50, 100).fill).toBe("var(--color-loss)");
  });

  it("scales opacity with magnitude and caps at the max mover", () => {
    expect(tileStyle(100, 100).fillOpacity).toBeGreaterThan(tileStyle(10, 100).fillOpacity);
    expect(tileStyle(100, 100).fillOpacity).toBeCloseTo(0.85);
  });
});

describe("ReportsSymbolHeatmap", () => {
  it("renders the empty state when no symbol has trades", () => {
    render(<ReportsSymbolHeatmap {...props} breakdown={[grp("MSFT", 0, 0)]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("shows the card title while loading", () => {
    render(<ReportsSymbolHeatmap {...props} loading breakdown={[]} />);
    expect(screen.getByText("Stock P&L")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test ReportsSymbolHeatmap`
Expected: FAIL — module `./ReportsSymbolHeatmap` cannot be resolved.

- [ ] **Step 3: Implement the component**

Create `web/src/components/ReportsSymbolHeatmap.tsx`:

```tsx
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { Card } from "./Card";
import { ChartFrame, chartTheme } from "./ChartFrame";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtMoneyCompact, fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";

export interface ReportsSymbolHeatmapProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

export interface HeatmapNode {
  name: string;
  size: number;
  netPnl: number;
}

/** One treemap node per symbol that has trades; area (size) encodes trade count. */
export function buildHeatmapNodes(breakdown: BreakGroup[]): HeatmapNode[] {
  return breakdown
    .filter((g) => g.summary.total_trades > 0)
    .map((g) => ({ name: g.key, size: g.summary.total_trades, netPnl: g.summary.net_pnl }));
}

/** Diverging fill: profit green / loss rose, opacity by |netPnl| vs the largest mover. */
export function tileStyle(netPnl: number, maxAbs: number): { fill: string; fillOpacity: number } {
  const fillOpacity = 0.25 + 0.6 * Math.min(1, Math.abs(netPnl) / Math.max(1, maxAbs));
  return { fill: netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)", fillOpacity };
}

interface HeatCellProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  netPnl?: number;
  payload?: HeatmapNode;
  maxAbs: number;
  currency: string;
  fxRate: number;
  locale: string;
}

function HeatCell({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  name,
  netPnl,
  payload,
  maxAbs,
  currency,
  fxRate,
  locale,
}: HeatCellProps) {
  if (width <= 0 || height <= 0) return null;
  // recharts spreads the node onto the cell props; fall back to payload if not.
  const net = netPnl ?? payload?.netPnl ?? 0;
  const label = name ?? payload?.name ?? "";
  const { fill, fillOpacity } = tileStyle(net, maxAbs);
  const showText = width > 44 && height > 28;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke="var(--color-bg-panel)"
        strokeWidth={1}
      />
      {showText ? (
        <>
          <text x={x + 6} y={y + 16} fontSize={11} fontWeight={600} fill="var(--color-text)">
            {label}
          </text>
          <text x={x + 6} y={y + 30} fontSize={10} fill="var(--color-text-muted)">
            {fmtMoneyCompact(net * fxRate, currency, locale)}
          </text>
        </>
      ) : null}
    </g>
  );
}

export function ReportsSymbolHeatmap({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsSymbolHeatmapProps) {
  usePrivacyMode();
  const locale = intlLocale();
  const nodes = buildHeatmapNodes(breakdown);
  const maxAbs = Math.max(1, ...nodes.map((n) => Math.abs(n.netPnl)));

  return (
    <Card title="Stock P&L">
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load stock P&L.</p>
      ) : nodes.length === 0 ? (
        <EmptyState title="No data" hint="Add trades or adjust filters to see the heatmap." />
      ) : (
        <ChartFrame className="border-0 rounded-none">
          <ResponsiveContainer width="100%" height={240}>
            <Treemap
              data={nodes}
              dataKey="size"
              isAnimationActive={false}
              content={
                <HeatCell maxAbs={maxAbs} currency={currency} fxRate={fxRate} locale={locale} />
              }
            >
              <Tooltip
                contentStyle={{
                  background: chartTheme.tooltipBg,
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  color: chartTheme.tooltipText,
                  fontSize: 11,
                }}
                formatter={(_v, _n, item) => {
                  const p = item?.payload as HeatmapNode | undefined;
                  if (!p) return ["", ""];
                  return [
                    `${fmtSignedMoney(p.netPnl * fxRate, currency, locale)} · ${p.size} trades`,
                    p.name,
                  ];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </ChartFrame>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test ReportsSymbolHeatmap`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportsSymbolHeatmap.tsx web/src/components/ReportsSymbolHeatmap.test.tsx
git commit -m "feat(web): add ReportsSymbolHeatmap treemap card (SP4)"
```

---

### Task 2: Tab-organize `ReportsView`

**Files:**
- Modify: `web/src/app/screens/ReportsView.tsx`
- Test: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `ReportsSymbolHeatmap` (Task 1); the `Tabs`/`TabsList`/`TabsTrigger`/`TabsIndicator`/`TabsContent` primitives.
- Produces: `export type ReportsTab = "overview" | "win-loss" | "detailed" | "risk";` and two new `ReportsViewProps` fields `tab: ReportsTab` and `onTabChange: (t: ReportsTab) => void`.

- [ ] **Step 1: Write the failing test**

In `web/src/app/screens/ReportsView.test.tsx`, add `tab: "overview" as const` and `onTabChange: vi.fn()` to the `base` object (after the `qualityBreakdown*` fields), then add these tests inside the `describe("ReportsView", …)` block:

```tsx
  it("shows only the active tab's sections", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        tab="overview"
        symbolBreakdown={[grp("AAPL", 200)]}
      />,
    );
    // Overview owns Execution Grade; Detailed owns the Symbol card + Stock P&L heatmap.
    expect(screen.getByText("Execution Grade")).toBeInTheDocument();
    expect(screen.queryByText("Stock P&L")).not.toBeInTheDocument();
    expect(screen.queryByText("Session")).not.toBeInTheDocument();
  });

  it("renders the Detailed tab's sections including the heatmap", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        tab="detailed"
        symbolBreakdown={[grp("AAPL", 200)]}
      />,
    );
    expect(screen.getByText("Stock P&L")).toBeInTheDocument();
    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.queryByText("Execution Grade")).not.toBeInTheDocument();
  });

  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
    render(
      <ReportsView {...base} dim="symbol" breakdown={[]} tab="overview" onTabChange={onTabChange} />,
    );
    screen.getByRole("tab", { name: "Detailed" }).click();
    expect(onTabChange).toHaveBeenCalledWith("detailed");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test ReportsView`
Expected: FAIL — TypeScript rejects the unknown `tab`/`onTabChange` props and the new assertions can't find tab roles.

- [ ] **Step 3: Add the import, type, and props**

In `web/src/app/screens/ReportsView.tsx`:

Add imports near the other component imports:

```tsx
import { ReportsSymbolHeatmap } from "../../components/ReportsSymbolHeatmap";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "../../components/Tabs";
```

Add the tab type next to `BreakdownDim` (after the `DIM_LABELS`/`SELECTOR_DIMS` block):

```tsx
export type ReportsTab = "overview" | "win-loss" | "detailed" | "risk";

const REPORT_TABS: { value: ReportsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "win-loss", label: "Win / Loss" },
  { value: "detailed", label: "Detailed" },
  { value: "risk", label: "Risk" },
];
```

Add to `ReportsViewProps` (after the `qualityBreakdown*` fields):

```tsx
  tab: ReportsTab;
  onTabChange: (t: ReportsTab) => void;
```

Add `tab,` and `onTabChange,` to the destructured `ReportsView` parameter list (after `qualityBreakdownError,`).

- [ ] **Step 4: Wrap the sections in tabs**

Replace the entire `return ( <Page> … </Page> )` body of `ReportsView` with the grouped structure below. The individual section elements are unchanged — only their grouping into panels is new. Keep the exact same props on each child as today.

```tsx
  return (
    <Page>
      <Tabs
        className="flex flex-col gap-4"
        value={tab}
        onValueChange={(v) => onTabChange(v as ReportsTab)}
      >
        <TabsList
          aria-label="Report sections"
          fullWidth
          className="h-10 rounded-control border-none bg-bg-input p-1"
        >
          <TabsIndicator className="rounded-control bg-bg-input-hover" />
          {REPORT_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              fullWidth
              className="h-full px-3 text-[12px] font-medium text-text-dim hover:text-text-muted data-active:text-text"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          {summaryLoading ? (
            <Skeleton height="120px" />
          ) : summaryError ? (
            <p className="p-4 text-xs text-loss">Failed to load summary.</p>
          ) : summary ? (
            <SummaryMetricsGrid
              summary={summary}
              trades={trades}
              tradesLoading={tradesLoading}
              currency={displayCurrency}
              fxRate={fxRate}
              equity={equity}
              equityLoading={equityLoading}
            />
          ) : null}

          <Card title="Playbook & Leaks" action={panelRight}>
            {renderContent()}
          </Card>

          <ReportsRMultiplePerformance
            rSummary={rSummary}
            loading={Boolean(rSummaryLoading)}
            error={Boolean(rSummaryError)}
          />

          <ReportsExecutionGrade
            breakdown={qualityBreakdown}
            loading={qualityBreakdownLoading}
            error={qualityBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="win-loss" className="flex flex-col gap-4">
          <ReportsRollingWinRate trades={trades} loading={tradesLoading} error={tradesError} />

          <ReportsMetricEvolution
            trades={trades}
            loading={tradesLoading}
            error={tradesError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="detailed" className="flex flex-col gap-4">
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

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportsBreakdownCard
              title="Day of Week"
              breakdown={dayOfWeekBreakdown}
              loading={dayOfWeekBreakdownLoading}
              error={dayOfWeekBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
              tableColumns={buildColumns(displayCurrency, "Day", fxRate)}
            />
            <ReportsHourlyList
              breakdown={hourOfDayBreakdown}
              loading={hourOfDayBreakdownLoading}
              error={hourOfDayBreakdownError}
              currency={displayCurrency}
              fxRate={fxRate}
            />
          </div>

          <ReportsSessionTable
            breakdown={sessionBreakdown}
            loading={sessionBreakdownLoading}
            error={sessionBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />

          <ReportsSymbolHeatmap
            breakdown={symbolBreakdown}
            loading={symbolBreakdownLoading}
            error={symbolBreakdownError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>

        <TabsContent value="risk" className="flex flex-col gap-4">
          <ReportsRiskDrawdown
            trades={trades}
            equityPoints={equity?.points ?? []}
            loading={tradesLoading || equityLoading}
            error={tradesError || equityError}
            currency={displayCurrency}
            fxRate={fxRate}
          />
        </TabsContent>
      </Tabs>
    </Page>
  );
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test ReportsView`
Expected: PASS — all prior cases (Overview-tab content) plus the three new tab cases.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): organize Reports into tabs, add heatmap to Detailed (SP4)"
```

---

### Task 3: Wire the tab search param in the route

**Files:**
- Modify: `web/src/routes/reports.tsx`
- Test: `web/src/routes/reports.search.test.ts`

**Interfaces:**
- Consumes: `ReportsTab` (Task 2), TanStack Router `createFileRoute`/`useNavigate`.
- Produces: `export function validateReportsSearch(search: Record<string, unknown>): { tab: ReportsTab }` (used as the route's `validateSearch`).

- [ ] **Step 1: Write the failing test**

Create `web/src/routes/reports.search.test.ts`:

```ts
import { describe, expect, it } from "vite-plus/test";
import { validateReportsSearch } from "./reports";

describe("validateReportsSearch", () => {
  it("passes through a valid tab", () => {
    expect(validateReportsSearch({ tab: "detailed" })).toEqual({ tab: "detailed" });
  });

  it("defaults to overview when tab is missing", () => {
    expect(validateReportsSearch({})).toEqual({ tab: "overview" });
  });

  it("coerces an unknown tab to overview", () => {
    expect(validateReportsSearch({ tab: "bogus" })).toEqual({ tab: "overview" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test reports.search`
Expected: FAIL — `validateReportsSearch` is not exported from `./reports`.

- [ ] **Step 3: Implement the route search wiring**

Edit `web/src/routes/reports.tsx`. Update the import to include `useNavigate` and the `ReportsTab` type:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { type BreakdownDim, type ReportsTab, ReportsView } from "../app/screens/ReportsView";
```

Add the validator and wire it into the route (replace the existing `export const Route = createFileRoute("/reports")({ component: ReportsPage });`):

```tsx
const REPORT_TAB_VALUES: ReportsTab[] = ["overview", "win-loss", "detailed", "risk"];

export function validateReportsSearch(search: Record<string, unknown>): { tab: ReportsTab } {
  const tab = search.tab;
  return {
    tab: REPORT_TAB_VALUES.includes(tab as ReportsTab) ? (tab as ReportsTab) : "overview",
  };
}

export const Route = createFileRoute("/reports")({
  validateSearch: validateReportsSearch,
  component: ReportsPage,
});
```

Inside `ReportsPage`, read the tab and add the navigate handler (place near the other hooks, after `const [dim, setDim] = useState<BreakdownDim>("setup");`):

```tsx
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const onTabChange = (next: ReportsTab) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, tab: next }) });
```

Pass the two new props into `<ReportsView>` (after the `qualityBreakdown*` props):

```tsx
      tab={tab}
      onTabChange={onTabChange}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test reports.search`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Run lint/typecheck and the Reports suites**

Run: `bun run lint && bun run test ReportsView ReportsSymbolHeatmap reports.search`
Expected: no type errors on the changed files; all three suites green. (Pre-existing lint drift in unrelated untouched files and the pre-existing `DashboardView "30D"` test failure are out of scope — confirm your changed files are clean.)

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/reports.tsx web/src/routes/reports.search.test.ts
git commit -m "feat(web): drive Reports tab from ?tab= search param (SP4)"
```

---

### Task 4: Runtime verification

**Files:** none (skill-driven verification).

- [ ] **Step 1: Launch the app and open Reports**

Use the `run` / `web:verify` skill to start the app, log in against a DB with seeded closed trades on multiple symbols, and open the Reports page.

- [ ] **Step 2: Verify tabs**

Click each tab (Overview / Win / Loss / Detailed / Risk) and confirm each shows exactly its mapped sections and nothing from other tabs. Confirm the KPI grid appears only under Overview. Confirm navigating to `/reports?tab=detailed` directly opens the Detailed tab, and a refresh preserves the active tab.

- [ ] **Step 3: Verify the heatmap**

On the Detailed tab, confirm the Stock P&L treemap renders one tile per symbol, tiles are sized by trade count and colored green/rose by net P&L, tile labels show symbol + compact P&L, and the tooltip shows signed P&L + trade count. Check light and dark themes and mobile + desktop widths.

- [ ] **Step 4: Final full check**

Run: `bun run lint && bun run test`
Expected: changed-file lint/type clean; Reports suites green (note any pre-existing unrelated failures explicitly).

---

## Notes

- Task 1 (heatmap) is independent; Task 2 depends on it (places it in Detailed); Task 3 depends on Task 2 (`ReportsTab` type + props). Task 4 depends on all.
- If recharts does not surface `netPnl` directly on the `HeatCell` props at runtime, it is read from `payload` (already handled in the cell); verify during Task 4.
