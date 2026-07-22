# Reports Filter Bar — Stage 2 (Net/Gross + $/% Display Modes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page-wide Net/Gross and $/% display-mode toggles to the Reports control bar, re-expressing every P&L value and P&L chart across the page via a shared context + hook.

**Architecture:** A `ReportsDisplayContext` (provided by `ReportsView`) carries `{ pnlMode, unitMode, denominator, currency, fxRate }`. A `useReportsMoney()` hook derives P&L values (net vs gross) and formatters ($ vs %). The two mode toggles live in `ReportsControlBar`; the route stores them as `?pnl=`/`?unit=` URL params and computes the % denominator from the selected account(s) `starting_balance`. Every P&L-bearing card/chart is converted from raw `net_pnl` + `fmtSignedMoney` to the hook.

**Tech Stack:** React + TypeScript, TanStack Router, recharts, vite-plus/test.

## Global Constraints

- Package manager is **bun**: `bun run test <name>`, `bun run lint`. NOT npm.
- URL params (optional, coerce unknown → default): `pnl` (`net|gross`, default `net`), `unit` (`abs|pct`, default `abs`). `%` is disabled when the denominator is 0 (no starting balance): the toggle falls back to `abs` at the hook level.
- **Net vs Gross:** net = `summary.net_pnl` / `trade.net_pnl`; gross = `summary.gross_profit - summary.gross_loss` / `trade.gross_pnl` (P&L before fees).
- **$ vs %:** `%` = displayValue ÷ denominator, where denominator = the selected account's `starting_balance` (summed across all accounts when "All accounts" is selected). Formatted with `fmtPct`.
- **Scope of modes:** applies to P&L dollar figures and P&L charts/tables. **Exempt** (unchanged — they are ratios/percentages, not P&L dollars): profit factor, win rate, payoff ratio, R-multiples, expectancy-in-R. The **equity curve stays net** (cumulative equity is inherently net); in `%` mode its axis/values divide by the denominator, but Net/Gross does not alter it.
- Reuse existing formatters (`fmtSignedMoney`, `fmtSignedMoneyCompact`, `fmtMoneyCompact`, `fmtPct`) and tokens. No new deps.
- Every converted component's existing tests must still pass — either wrap the render in `ReportsDisplayProvider` or rely on the hook's built-in default context (net/$), which keeps the current assertions valid.

---

### Task 1: `ReportsDisplayContext` + `useReportsMoney` hook

**Files:**
- Create: `web/src/components/ReportsDisplayContext.tsx`
- Test: `web/src/components/ReportsDisplayContext.test.tsx`

**Interfaces:**
- Produces: `PnlMode`, `UnitMode`, `ReportsDisplay` types; `ReportsDisplayProvider`; `useReportsMoney()` returning `{ pnlMode, unitMode, pctEnabled, pnl, tradePnl, display, format, formatCompact, formatAxis }`.

Hook contract (roles are distinct — read carefully):
- `pnl(s: Summary): number` — raw net/gross P&L (pre-fx, pre-unit).
- `tradePnl(t: Trade): number` — raw net/gross P&L for a trade.
- `display(rawPnl: number): number` — the numeric value to **plot** on a chart: `abs` → `rawPnl*fxRate`; `pct` → `rawPnl*fxRate/denominator`.
- `format(rawPnl: number): string` — text for a **raw** P&L value: `abs` → `fmtSignedMoney(rawPnl*fxRate, …)`; `pct` → `fmtPct(rawPnl*fxRate/denominator, …)`.
- `formatCompact(rawPnl: number): string` — compact variant of `format`.
- `formatAxis(displayValue: number): string` — text for an **already-plotted** value (recharts tick/tooltip): `abs` → `fmtSignedMoneyCompact(displayValue, …)`; `pct` → `fmtPct(displayValue, …)`. (Does NOT re-apply fxRate/denominator.)

- [ ] **Step 1: Write the failing test**

Create `web/src/components/ReportsDisplayContext.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import type { Summary } from "../lib/api/types";
import { ReportsDisplayProvider, useReportsMoney, type ReportsDisplay } from "./ReportsDisplayContext";

function summary(over: Partial<Summary>): Summary {
  return {
    total_trades: 1, wins: 1, losses: 0, breakeven: 0, win_rate: 1,
    net_pnl: 0, gross_profit: 0, gross_loss: 0, profit_factor: 0, expectancy: 0,
    avg_win: 0, avg_loss: 0, avg_trade: 0, largest_win: 0, largest_loss: 0, total_fees: 0,
    ...over,
  };
}

function wrapper(value: ReportsDisplay) {
  return ({ children }: { children: ReactNode }) => (
    <ReportsDisplayProvider value={value}>{children}</ReportsDisplayProvider>
  );
}

const s = summary({ net_pnl: 100, gross_profit: 150, gross_loss: 30 }); // gross = 120

describe("useReportsMoney", () => {
  it("net mode returns net_pnl; gross mode returns gross_profit - gross_loss", () => {
    const net = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({ pnlMode: "net", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }),
    });
    expect(net.result.current.pnl(s)).toBe(100);
    const gross = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({ pnlMode: "gross", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 1 }),
    });
    expect(gross.result.current.pnl(s)).toBe(120);
  });

  it("abs mode formats money; pct mode divides by the denominator", () => {
    const pct = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({ pnlMode: "net", unitMode: "pct", denominator: 1000, currency: "USD", fxRate: 1 }),
    });
    expect(pct.result.current.display(100)).toBeCloseTo(0.1); // 100/1000
    expect(pct.result.current.format(100)).toBe(pct.result.current.formatAxis(0.1)); // both render 10%
    expect(pct.result.current.pctEnabled).toBe(true);
  });

  it("pct is disabled (falls back to abs) when denominator is 0", () => {
    const noBasis = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({ pnlMode: "net", unitMode: "pct", denominator: 0, currency: "USD", fxRate: 1 }),
    });
    expect(noBasis.result.current.pctEnabled).toBe(false);
    expect(noBasis.result.current.display(100)).toBe(100); // abs fallback, not /0
  });

  it("applies fxRate in abs mode", () => {
    const fx = renderHook(() => useReportsMoney(), {
      wrapper: wrapper({ pnlMode: "net", unitMode: "abs", denominator: 0, currency: "USD", fxRate: 2 }),
    });
    expect(fx.result.current.display(100)).toBe(200);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test ReportsDisplayContext`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the context + hook**

Create `web/src/components/ReportsDisplayContext.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from "react";
import type { Summary, Trade } from "../lib/api/types";
import { fmtPct, fmtSignedMoney, fmtSignedMoneyCompact } from "../lib/format";
import { intlLocale } from "../lib/locale";

export type PnlMode = "net" | "gross";
export type UnitMode = "abs" | "pct";

export interface ReportsDisplay {
  pnlMode: PnlMode;
  unitMode: UnitMode;
  denominator: number; // % basis (starting balance); 0 disables %
  currency: string;
  fxRate: number;
}

const DEFAULT: ReportsDisplay = {
  pnlMode: "net",
  unitMode: "abs",
  denominator: 0,
  currency: "USD",
  fxRate: 1,
};

const Ctx = createContext<ReportsDisplay>(DEFAULT);

export function ReportsDisplayProvider({
  value,
  children,
}: {
  value: ReportsDisplay;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReportsMoney() {
  const d = useContext(Ctx);
  const locale = intlLocale();
  const pctEnabled = d.denominator > 0;
  const usePct = d.unitMode === "pct" && pctEnabled;

  const pnl = (s: Summary) => (d.pnlMode === "gross" ? s.gross_profit - s.gross_loss : s.net_pnl);
  const tradePnl = (t: Trade) =>
    d.pnlMode === "gross" ? t.gross_pnl ?? t.net_pnl : t.net_pnl;

  const display = (rawPnl: number) =>
    usePct ? (rawPnl * d.fxRate) / d.denominator : rawPnl * d.fxRate;
  const format = (rawPnl: number) =>
    usePct
      ? fmtPct((rawPnl * d.fxRate) / d.denominator, locale)
      : fmtSignedMoney(rawPnl * d.fxRate, d.currency, locale);
  const formatCompact = (rawPnl: number) =>
    usePct
      ? fmtPct((rawPnl * d.fxRate) / d.denominator, locale)
      : fmtSignedMoneyCompact(rawPnl * d.fxRate, d.currency, locale);
  const formatAxis = (displayValue: number) =>
    usePct ? fmtPct(displayValue, locale) : fmtSignedMoneyCompact(displayValue, d.currency, locale);

  return {
    pnlMode: d.pnlMode,
    unitMode: usePct ? "pct" : "abs",
    pctEnabled,
    pnl,
    tradePnl,
    display,
    format,
    formatCompact,
    formatAxis,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test ReportsDisplayContext`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportsDisplayContext.tsx web/src/components/ReportsDisplayContext.test.tsx
git commit -m "feat(web): add ReportsDisplayContext + useReportsMoney (SP5 stage 2)"
```

---

### Task 2: Mode toggles + provider wiring

**Files:**
- Modify: `web/src/components/ReportsControlBar.tsx`, `web/src/routes/reports.tsx`, `web/src/app/screens/ReportsView.tsx`
- Test: `web/src/components/ReportsControlBar.test.tsx`, `web/src/routes/-reports.search.test.ts`, `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `PnlMode`/`UnitMode` (Task 1), `ReportsDisplayProvider`.
- Produces: `ReportsControlBar` gains `pnlMode`/`unitMode`/`onPnlModeChange`/`onUnitModeChange`/`pctEnabled` props; `ReportsViewProps` gains the same plus a `denominator: number`; `validateReportsSearch` returns `{ tab, side, dur, pnl, unit }`.

- [ ] **Step 1: Write the failing tests**

In `web/src/components/ReportsControlBar.test.tsx`, extend `base` with `pnlMode: "net" as const, unitMode: "abs" as const, onPnlModeChange: vi.fn(), onUnitModeChange: vi.fn(), pctEnabled: true`, and add:

```tsx
  it("renders the Net/Gross and $/% toggles", () => {
    render(<ReportsControlBar {...base} />);
    expect(screen.getByRole("tab", { name: "Net" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Gross" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "$" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "%" })).toBeInTheDocument();
  });

  it("calls onPnlModeChange and onUnitModeChange", () => {
    const onPnlModeChange = vi.fn();
    const onUnitModeChange = vi.fn();
    render(<ReportsControlBar {...base} onPnlModeChange={onPnlModeChange} onUnitModeChange={onUnitModeChange} />);
    screen.getByRole("tab", { name: "Gross" }).click();
    expect(onPnlModeChange).toHaveBeenCalledWith("gross");
    screen.getByRole("tab", { name: "%" }).click();
    expect(onUnitModeChange).toHaveBeenCalledWith("pct");
  });
```

In `web/src/routes/-reports.search.test.ts`, update the existing `toEqual` assertions to include `pnl: "net", unit: "abs"`, and add a coercion case:

```ts
  it("defaults and coerces pnl/unit", () => {
    expect(validateReportsSearch({})).toMatchObject({ pnl: "net", unit: "abs" });
    expect(validateReportsSearch({ pnl: "gross", unit: "pct" })).toMatchObject({ pnl: "gross", unit: "pct" });
    expect(validateReportsSearch({ pnl: "x", unit: "y" })).toMatchObject({ pnl: "net", unit: "abs" });
  });
```

In `web/src/app/screens/ReportsView.test.tsx`, add `pnlMode: "net" as const, unitMode: "abs" as const, denominator: 0, onPnlModeChange: vi.fn(), onUnitModeChange: vi.fn()` to `base`, and assert the toggles render:

```tsx
  it("renders the display-mode toggles", () => {
    render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
    expect(screen.getByRole("tab", { name: "Gross" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "%" })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test ReportsControlBar reports.search ReportsView`
Expected: FAIL — toggles/props/params missing.

- [ ] **Step 3: Add the toggles to `ReportsControlBar`**

Extend `ReportsControlBarProps` and render two more `SegmentedControl`s. Add to the imports: `import type { PnlMode, UnitMode } from "./ReportsDisplayContext";`. Add props:

```tsx
  pnlMode: PnlMode;
  unitMode: UnitMode;
  onPnlModeChange: (m: PnlMode) => void;
  onUnitModeChange: (m: UnitMode) => void;
  pctEnabled: boolean;
```

Add option arrays and render (after the Duration control, so the bar reads Side · Duration · Net/Gross · $/%):

```tsx
const PNL_OPTS = [
  { value: "net", label: "Net" },
  { value: "gross", label: "Gross" },
];
const UNIT_OPTS = [
  { value: "abs", label: "$" },
  { value: "pct", label: "%" },
];
```

```tsx
      <SegmentedControl
        ariaLabel="P&L basis"
        size="xs"
        options={PNL_OPTS}
        value={pnlMode}
        onChange={(v) => onPnlModeChange(v as PnlMode)}
      />
      <SegmentedControl
        ariaLabel="Unit"
        size="xs"
        options={UNIT_OPTS}
        value={unitMode}
        onChange={(v) => onUnitModeChange(v as UnitMode)}
      />
```

(When `pctEnabled` is false, still render the `%` option but pass `title="Set an account starting balance to view %"` on the wrapping element — the hook already forces abs, so selecting % is a no-op display-wise.)

- [ ] **Step 4: Extend `validateReportsSearch` + route wiring**

In `web/src/routes/reports.tsx`:
- Import `PnlMode`/`UnitMode` from `../components/ReportsDisplayContext` and `accountBaseCurrency` is already imported; also import `useAccounts` (already imported).
- Add `const PNL_VALUES: PnlMode[] = ["net", "gross"]; const UNIT_VALUES: UnitMode[] = ["abs", "pct"];` and extend `validateReportsSearch` to also return `pnl` and `unit` (same coercion pattern as `side`/`dur`), updating its return type to `{ tab; side; dur; pnl: PnlMode; unit: UnitMode }`.
- Read `pnl`/`unit` from `Route.useSearch()`; add `onPnlModeChange`/`onUnitModeChange` handlers (navigate with `search: (prev) => ({ ...prev, pnl: next })` / `unit`).
- Compute the denominator from accounts: `const denominator = useMemo(() => { const accts = accountsQ.data ?? []; const scope = accountId ? accts.filter((a) => a.id === accountId) : accts; return scope.reduce((sum, a) => sum + (a.starting_balance || 0), 0); }, [accountsQ.data, accountId]);`
- Pass `pnlMode={pnl}`, `unitMode={unit}`, `denominator`, `onPnlModeChange`, `onUnitModeChange` to `<ReportsView>`.

- [ ] **Step 5: Provide the context in `ReportsView`**

In `web/src/app/screens/ReportsView.tsx`:
- Import `ReportsDisplayProvider` and the `PnlMode`/`UnitMode` types.
- Add to `ReportsViewProps`: `pnlMode: PnlMode; unitMode: UnitMode; denominator: number; onPnlModeChange: (m: PnlMode) => void; onUnitModeChange: (m: UnitMode) => void;` and destructure them.
- Compute `pctEnabled = denominator > 0`.
- Wrap the entire `<Page>` body in `<ReportsDisplayProvider value={{ pnlMode, unitMode, denominator, currency: displayCurrency, fxRate }}>`.
- Pass the four mode props + `pctEnabled` into `<ReportsControlBar>`.

- [ ] **Step 6: Run tests + lint**

Run: `bun run lint && bun run test ReportsControlBar reports.search ReportsView ReportsDisplayContext`
Expected: green; changed files type-clean. (At this point the toggles exist and persist in the URL, but cards still render net-$; that's expected until Tasks 3–5.)

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ReportsControlBar.tsx web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/components/ReportsControlBar.test.tsx web/src/routes/-reports.search.test.ts web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): add net/gross + \$/% toggles and provider wiring (SP5 stage 2)"
```

---

### Conversion tasks (3–5): the pattern

Each conversion task rewrites P&L reads/formatting in a group of components to use `useReportsMoney()`. **The pattern, applied to every P&L dollar value:**

- Replace a raw `summary.net_pnl` (or a `net_pnl * fxRate`) read used for **text** with `money.format(money.pnl(summary))`.
- Replace a raw per-trade `trade.net_pnl` read with `money.tradePnl(trade)` (then `money.format(...)` for text).
- Replace **chart series** values `net_pnl * fxRate` with `money.display(money.pnl(summary))` and the axis/tooltip `tickFormatter`/`formatter` with `money.formatAxis`.
- Drop the component's own `* fxRate` and direct `fmtSignedMoney(..., currency, locale)` calls for P&L (the hook owns fx + currency + unit). Keep `currency`/`fxRate` props only where the component is also used outside Reports.
- Add `const money = useReportsMoney();` at the top of each converted component.
- **Do NOT convert** ratio/percentage figures (profit factor, win rate, payoff, R-multiples) — leave them exactly as-is.
- Update each component's tests to render inside `<ReportsDisplayProvider value={{ pnlMode:"net", unitMode:"abs", denominator:0, currency:"USD", fxRate:1 }}>` (money assertions stay valid under net/$), and add at least one assertion under `pnlMode:"gross"` or `unitMode:"pct"` proving the value re-expresses.

**Worked exemplar — `ReportsExecutionGrade.tsx`** (Task 3 includes this):
- Add `const money = useReportsMoney();`.
- The row net-P&L: replace `fmtSignedMoney(net, currency, locale)` (where `net = g.summary.net_pnl * fxRate`) with `money.format(money.pnl(g.summary))`, and the color class `pnlColor(g.summary.net_pnl)` with `pnlColor(money.pnl(g.summary))`.
- The proportional bar's `maxAbs`/`pct` use `money.pnl(g.summary)` (raw) so proportions match the displayed sign/magnitude; `barColor` off `money.pnl(g.summary)`.
- Leave `pfText(g.summary.profit_factor)` unchanged (ratio, exempt).
- Test: wrap in the provider; add a case with `pnlMode:"gross"` asserting a grade row shows the gross figure.

---

### Task 3: Convert the breakdown-family cards

**Files:** `web/src/components/ReportsExecutionGrade.tsx`, `ReportsSymbolHeatmap.tsx`, `ReportsBreakdownCard.tsx`, `ReportsHourlyList.tsx`, `ReportsSessionTable.tsx` (+ their `.test.tsx`); the `buildColumns` table-column builder in `web/src/app/screens/ReportsView.tsx`.

- [ ] **Step 1:** For EACH component above, write/extend a failing test that renders it inside `ReportsDisplayProvider` with `pnlMode:"gross"` (and one with `unitMode:"pct", denominator:1000`) and asserts the displayed P&L equals the gross / percentage value, not the net-$ value. Run `bun run test <name>` → RED.
- [ ] **Step 2:** Apply the conversion pattern to each component (and to `buildColumns`, whose P&L cell/formatter must use the hook — note `buildColumns` is a plain function, so pass it a `money` object or move the cell to a small component that calls `useReportsMoney()`; prefer converting the Net P&L column cell to a tiny inline component that uses the hook). Run each `bun run test <name>` → GREEN.
- [ ] **Step 3:** `bun run lint && bun run test ReportsExecutionGrade ReportsSymbolHeatmap ReportsBreakdownCard ReportsHourlyList ReportsSessionTable ReportsView` → all green.
- [ ] **Step 4:** Commit: `git commit -m "feat(web): breakdown cards honor net/gross + \$/% (SP5 stage 2)"`

---

### Task 4: Convert the KPI summary family

**Files:** `web/src/components/ReportsSummaryBento.tsx`, `web/src/components/ReportsInsightWidgets.tsx`, and the inline `SummaryMetricsGrid` in `web/src/app/screens/ReportsView.tsx` (+ their tests).

- [ ] **Step 1:** Write/extend failing tests: `ReportsSummaryBento` and `ReportsInsightWidgets` rendered under `pnlMode:"gross"` show the gross Net-P&L figure; under `unitMode:"pct"` show a percentage. Only P&L dollar cells change — win rate / profit factor / payoff stay. Run → RED.
- [ ] **Step 2:** Apply the pattern: the Net P&L, Gross (already shown), Expectancy(as $), Avg trade, Avg win, Avg loss, Largest win/loss, Total fees, and Max drawdown dollar figures use `money.format(money.pnl(...))` where a summary field is a P&L dollar (for non-`net_pnl` dollar fields like `avg_trade`, format via `money.format(field)` in abs, and note gross does not change those single fields — only `net_pnl`-derived totals differ between net/gross; keep per-field values but apply the `$/%` unit via `money.format`). Equity curve stays net; in `%` mode its axis divides by denominator via `money.formatAxis` on `money.display`-scaled points. Leave win rate / PF / payoff / R exempt. Run → GREEN.
- [ ] **Step 3:** `bun run lint && bun run test ReportsSummaryBento ReportsInsightWidgets ReportsView` → green.
- [ ] **Step 4:** Commit: `git commit -m "feat(web): KPI summary honors net/gross + \$/% (SP5 stage 2)"`

---

### Task 5: Convert the trend/risk charts

**Files:** `web/src/components/ReportsMetricEvolution.tsx`, `web/src/components/ReportsRiskDrawdown.tsx` (+ tests). (`ReportsRollingWinRate` = win-rate %, `ReportsRMultiplePerformance` = R ratios — **exempt, do not change**.)

- [ ] **Step 1:** Write/extend failing tests: the P&L-dollar series/axis in `ReportsMetricEvolution` and the drawdown-dollar figures in `ReportsRiskDrawdown` re-express under `unitMode:"pct"` (and net/gross where the metric is P&L). Run → RED.
- [ ] **Step 2:** Apply the pattern to the P&L-dollar series and their axis/tooltip formatters (`money.display` for series, `money.formatAxis` for ticks/tooltips; `money.tradePnl` where a per-trade P&L feeds the series). Leave non-P&L metrics (win rate, R) unchanged. Run → GREEN.
- [ ] **Step 3:** `bun run lint && bun run test ReportsMetricEvolution ReportsRiskDrawdown` → green.
- [ ] **Step 4:** Commit: `git commit -m "feat(web): trend/risk charts honor net/gross + \$/% (SP5 stage 2)"`

---

### Task 6: Runtime verification (Stage 2)

**Files:** none.

- [ ] **Step 1:** Launch (`run`/`web:verify`, Vite :5173, Playwright MCP). Open `/reports`.
- [ ] **Step 2:** Toggle **Gross** — confirm every P&L figure/chart on all four tabs shifts to the before-fees value (Net P&L moves toward Gross; ratios like win rate / profit factor are unchanged) and `?pnl=gross` is in the URL.
- [ ] **Step 3:** Toggle **%** — confirm P&L figures render as percentages of starting balance across cards and chart axes, and `?unit=pct` is in the URL. With an account whose starting balance is 0 (or "All" summing to 0), confirm `%` is inert (falls back to $).
- [ ] **Step 4:** Confirm deep-link `/reports?pnl=gross&unit=pct&side=long` applies all three on load. Light/dark + mobile/desktop.
- [ ] **Step 5:** `bun run lint && bun run test` and `cd api && go test ./...` → green (note any pre-existing unrelated failures).

---

## Notes

- Task order: 1 (mechanism) → 2 (toggles/provider) → 3/4/5 (conversions, independent of each other, all depend on 1+2) → 6 (verify).
- The hook's default context (net/$) means an unconverted component keeps working, so Tasks 3–5 can land incrementally without breaking the page.
- `buildColumns` is a plain function outside React — convert its Net P&L cell to a tiny inline component that calls `useReportsMoney()`, rather than trying to call the hook in a non-component function.
