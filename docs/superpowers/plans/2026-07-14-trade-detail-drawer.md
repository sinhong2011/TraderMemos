# Trade Detail Drawer Bento-Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `TradeDetailSheet` into a "rich glance" panel: dates, fee breakdown, R-multiple, tags/setup, notes preview, bento hero P&L block, restyled executions, and an inset chart empty state.

**Architecture:** All changes live in `web/src/components/TradeDetailSheet.tsx` (drawer content) plus one shared tweak in `web/src/components/charts/TradeChart.tsx` (empty-state well). No API changes — every new field already exists on `TradeDetail`. Spec: `docs/superpowers/specs/2026-07-14-trade-detail-drawer-design.md`.

**Tech Stack:** React 19 + TypeScript, Tailwind v4 tokens from `web/src/styles.css`, Vite+ (`vp test`, `vp check`), vitest-style tests via `vite-plus/test`, Testing Library.

## Global Constraints

- Run all commands from `web/` (`cd web` first). Validate with `vp check` and `vp test`.
- Follow DESIGN.md tokens exactly: surfaces `bg-bg-panel`/`bg-bg-elevated`/`bg-bg-inset`, hairlines `bg-border`, radius `rounded-sharp` for data cells / `rounded-control` for controls, section labels `text-signal` 10px uppercase, P&L glow only via existing `hero-glow-profit` / `hero-glow-loss` utilities.
- Borderless preference: no decorative borders on rows/sections; separation via spacing, hairline gaps, and hover states.
- Drawer stays **read-only**; no editing affordances.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing test file `web/src/components/TradeDetailSheet.test.tsx` already has a `TRADE` fixture, `wrap()` helper, and mocks for `useTradeDetail`, `@tanstack/react-router`, and `TradeChartSection` — extend it, don't recreate it.

---

### Task 1: Header identity + status line with dates

**Files:**
- Modify: `web/src/components/TradeDetailSheet.tsx`
- Test: `web/src/components/TradeDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `marketLabel`, `tradeStatus` from `./tradeColumns`; `intlLocale` from `../lib/locale`; existing `TradeDetail` fields `opened_at`, `closed_at`, `status`.
- Produces: module-local helper `fmtWhen(iso: string): string` (short date-time, e.g. `Jul 12, 04:00 PM`) — reused by Task 4 for execution timestamps.

- [ ] **Step 1: Write the failing tests**

In `TradeDetailSheet.test.tsx`, replace the existing `it("shows WIN status, meta strip, and collapses empty plan dashes", …)` block's pill assertions and add an open-trade case. The fixture dates are `2026-07-14T01:35:00Z`; rendered text depends on the test locale/timezone, so assert with a regex on the date part only:

```tsx
  it("shows WIN status, dates, and collapses empty plan dashes", () => {
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("WIN")).toBeInTheDocument();
    // Identity moved into the drawer title: "CL8698 · STK · LONG"
    expect(screen.getByText(/· STK · LONG/)).toBeInTheDocument();
    expect(screen.getByText("+$2.50")).toBeInTheDocument();
    // Status line shows opened → closed dates (Jul 13 or 14 depending on TZ)
    expect(screen.getByText(/Jul 1[34].*→.*Jul 1[34]/)).toBeInTheDocument();
    expect(screen.getByText("Entry")).toBeInTheDocument();
    expect(screen.getByText("Exit")).toBeInTheDocument();
    expect(screen.queryByText("Target")).not.toBeInTheDocument();
    expect(screen.getByText(/Executions \(2\)/i)).toBeInTheDocument();
  });

  it("shows OPEN status with 'still open' and dash exit for open trades", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...TRADE,
        status: "open",
        closed_at: null,
        avg_exit_price: null,
        net_pnl: null,
        gross_pnl: null,
        return_pct: null,
        qty_remaining: 5,
        time_in_trade_secs: null,
      },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText(/still open/)).toBeInTheDocument();
    expect(screen.queryByText("+$2.50")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: FAIL — `· STK · LONG`, date regex, and `still open` not found.

- [ ] **Step 3: Implement header + status line**

In `TradeDetailSheet.tsx`:

Add the shared time formatter near the top (module scope, after imports):

```tsx
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

Replace `<DrawerTitle>{detailQ.data?.symbol ?? "Trade"}</DrawerTitle>` with:

```tsx
<DrawerTitle className="flex items-baseline gap-1.5">
  {detailQ.data ? (
    <>
      {detailQ.data.symbol}
      <span className="text-xs font-medium text-text-muted">
        · {marketLabel(detailQ.data.instrument_type)} · {detailQ.data.direction.toUpperCase()}
      </span>
    </>
  ) : (
    "Trade"
  )}
</DrawerTitle>
```

In `TradeDetailSheetBody`, replace the pill row (the `flex flex-wrap items-center gap-2` div containing the three `Pill`s) with a status line — the direction and market pills are gone; only the status pill remains:

```tsx
<div className="flex flex-wrap items-center gap-2.5">
  <Pill tone={status.tone} title={status.label === "BE" ? "Break-even" : undefined}>
    {status.label}
  </Pill>
  <span className="text-xs tabular-nums text-text-muted">
    {trade.status === "open"
      ? `${fmtWhen(trade.opened_at)} · still open`
      : `${fmtWhen(trade.opened_at)} → ${
          trade.closed_at ? fmtWhen(trade.closed_at) : "—"
        }${hold === "-" ? "" : ` · ${hold}`}`}
  </span>
</div>
```

Guard the hero P&L paragraph: it already renders only when `pnl != null`, keep that. Remove the now-unused `marketLabel` pill usage but keep the `marketLabel` import (used in the title).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TradeDetailSheet.tsx web/src/components/TradeDetailSheet.test.tsx
git commit -m "feat(web): trade drawer header identity + status line with dates

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Bento hero block (P&L cell + stat cells)

**Files:**
- Modify: `web/src/components/TradeDetailSheet.tsx`
- Test: `web/src/components/TradeDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `heroPnlClass`, `pnlColor` from `./theme-tokens`; `fmtMoney`, `fmtSignedMoney` from `../lib/format`; CSS utilities `hero-glow-profit` / `hero-glow-loss` (defined in `web/src/styles.css`); `hold` label from Task 1.
- Produces: component-local `BentoStat({ label, value }: { label: string; value: string })` replacing `MetaStat`. Cells sit on `bg-bg-elevated` with `gap-px` hairlines over `bg-border`.

- [ ] **Step 1: Write the failing tests**

Add to the closed-trade test in `TradeDetailSheet.test.tsx` (and update the fixture: set `fees_total: 0.35`, `r_multiple: 0.5` on a spread copy inside the test rather than mutating `TRADE`):

```tsx
  it("renders bento hero with fees cell, gross breakdown, and R-multiple", () => {
    mockedDetail.mockReturnValue({
      data: { ...TRADE, fees_total: 0.35, gross_pnl: 2.85, r_multiple: 0.5 },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("$0.35")).toBeInTheDocument();
    expect(screen.getByText(/\+\$2\.85 gross/)).toBeInTheDocument();
    expect(screen.getByText("+0.50R")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: FAIL — "Fees" label and gross line not found.

- [ ] **Step 3: Implement the bento block**

In `TradeDetailSheet.tsx`, rename `MetaStat` to `BentoStat` and give it the cell surface:

```tsx
function BentoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-bg-elevated p-3">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-sm tabular-nums text-text">{value}</span>
    </div>
  );
}
```

Replace the hero P&L paragraph **and** the `mt-4 grid grid-cols-2 …` MetaStat grid with one bento grid (directly after the status line, inside the same outer `<div>`):

```tsx
<div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-px overflow-hidden rounded-sharp bg-border">
  <div className="row-span-2 flex flex-col justify-between gap-3 bg-bg-elevated p-3.5">
    <div>
      {pnl != null ? (
        <>
          <p
            className={cn(
              "m-0 tabular-nums",
              heroPnlClass(pnl),
              pnl > 0 && "hero-glow-profit",
              pnl < 0 && "hero-glow-loss",
            )}
          >
            {fmtSignedMoney(pnl, currency, intlLocale())}
          </p>
          <p className="mt-1.5 mb-0 text-sm font-semibold tabular-nums">
            {trade.return_pct != null && (
              <span className={pnlColor(trade.return_pct)}>
                {trade.return_pct >= 0 ? "+" : ""}
                {trade.return_pct.toFixed(2)}%
              </span>
            )}
            {trade.r_multiple != null && (
              <span className={cn("ml-2", pnlColor(trade.r_multiple))}>
                {trade.r_multiple >= 0 ? "+" : ""}
                {trade.r_multiple.toFixed(2)}R
              </span>
            )}
          </p>
        </>
      ) : (
        <p className="m-0 text-[32px] font-semibold leading-none text-flat">—</p>
      )}
    </div>
    {trade.gross_pnl != null && (
      <p className="m-0 text-[10px] tabular-nums text-text-dim">
        {fmtSignedMoney(trade.gross_pnl, currency, intlLocale())} gross −{" "}
        {fmtMoney(trade.fees_total, currency, intlLocale())} fees
      </p>
    )}
  </div>
  <div className="grid grid-cols-2 gap-px">
    <BentoStat label="Entry" value={fmtMoney(trade.avg_entry_price, currency, intlLocale())} />
    <BentoStat
      label="Exit"
      value={
        trade.avg_exit_price != null
          ? fmtMoney(trade.avg_exit_price, currency, intlLocale())
          : "—"
      }
    />
  </div>
  <div className="grid grid-cols-3 gap-px">
    <BentoStat label="Qty" value={qty.toFixed(2)} />
    <BentoStat label="Hold" value={hold === "-" ? "—" : hold} />
    <BentoStat label="Fees" value={fmtMoney(trade.fees_total, currency, intlLocale())} />
  </div>
</div>
```

Note: the nested `grid gap-px` containers have no background of their own, so the outer `bg-border` shows through every gap as a hairline. Do not add borders.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: PASS (Task 1 tests still green — labels "Entry"/"Exit" unchanged).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TradeDetailSheet.tsx web/src/components/TradeDetailSheet.test.tsx
git commit -m "feat(web): bento hero P&L block in trade drawer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Context row (tags + setup) and notes preview

**Files:**
- Modify: `web/src/components/TradeDetailSheet.tsx`
- Test: `web/src/components/TradeDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `trade.tags: Tag[]` (`{ id, name, … }`), `trade.setup: Setup | null` (`{ name, … }`), `trade.notes: string`; `Pill` component; Lucide `Zap`.
- Produces: `TradeDetailSheetBody` gains prop `onOpenFullPage: () => void`; `TradeDetailSheet` passes a callback that navigates to `/trades/$id` and closes the drawer (same behavior as the header "Open full page" button — extract it into one function used by both).

- [ ] **Step 1: Write the failing tests**

```tsx
  it("shows tags, setup name, and a clamped notes preview", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...TRADE,
        tags: [
          {
            id: "tag1",
            user_id: "u1",
            name: "Breakout",
            color: "#34d399",
            description: "",
            kind: "custom",
          },
        ],
        setup: {
          id: "s1",
          user_id: "u1",
          name: "ORB Fade",
          description: "",
          created_at: "2026-01-01T00:00:00Z",
          thesis: "",
          symbol: "",
          direction: "",
          target_price: null,
          stop_price: null,
          checklist: [],
        },
        notes: "Clean break of overnight high.\nSized down due to CPI.",
      },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("Breakout")).toBeInTheDocument();
    expect(screen.getByText("ORB Fade")).toBeInTheDocument();
    expect(screen.getByText(/Clean break of overnight high/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /read more/i })).toBeInTheDocument();
  });

  it("omits context row and notes section when empty", () => {
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);
    expect(screen.queryByText("Setup:")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /read more/i })).not.toBeInTheDocument();
  });
```

(`Tag` needs importing in the test file only if not already imported — the fixture object literals above are typed structurally through `...TRADE` spread, so no new import is required.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: FAIL — "ORB Fade" and "Read more" not found.

- [ ] **Step 3: Implement context row + notes preview**

In `TradeDetailSheet` (parent), extract the full-page navigation into one callback and pass it down:

```tsx
const openFullPage = () => {
  if (!tradeId) return;
  void navigate({ to: "/trades/$id", params: { id: tradeId } });
  onClose();
};
```

Use `openFullPage` in the existing header button's `onClick`, and render the body as
`<TradeDetailSheetBody trade={detailQ.data} onOpenFullPage={openFullPage} />`.

In `TradeDetailSheetBody` (signature becomes
`{ trade, onOpenFullPage }: { trade: TradeDetail; onOpenFullPage: () => void }`), add the context row directly after the bento grid's closing `</div>` (still inside the first section div):

```tsx
{(trade.tags.length > 0 || trade.setup) && (
  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
    {trade.tags.map((t) => (
      <Pill key={t.id} tone="muted">
        {t.name}
      </Pill>
    ))}
    {trade.setup && (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <Zap size={14} strokeWidth={1.5} className="text-signal" />
        Setup: <span className="font-medium text-text">{trade.setup.name}</span>
      </span>
    )}
  </div>
)}
```

Add the notes section after the executions `<section>` (end of the body column):

```tsx
{trade.notes.trim() !== "" && (
  <section>
    <p className={sectionLabelClass}>Notes</p>
    <p className="m-0 line-clamp-3 text-sm whitespace-pre-wrap text-text-muted">{trade.notes}</p>
    <button
      type="button"
      onClick={onOpenFullPage}
      className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-xs text-accent hover:underline"
    >
      Read more
    </button>
  </section>
)}
```

Import `Zap` from `lucide-react` (extend the existing `ExternalLink, X` import).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TradeDetailSheet.tsx web/src/components/TradeDetailSheet.test.tsx
git commit -m "feat(web): tags, setup, and notes preview in trade drawer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Executions restyle (side chips, fees, hover rows)

**Files:**
- Modify: `web/src/components/TradeDetailSheet.tsx`
- Test: `web/src/components/TradeDetailSheet.test.tsx`

**Interfaces:**
- Consumes: `fmtWhen` from Task 1; `Execution` fields `side`, `quantity`, `price`, `fees`, `commission`, `executed_at`; tint utilities `bg-tint-pos` / `bg-tint-neg` (defined in `styles.css`).
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

```tsx
  it("renders execution rows with side chips and fee amounts", () => {
    mockedDetail.mockReturnValue({
      data: {
        ...TRADE,
        fills: [
          { ...TRADE.fills[0]!, fees: 0.25, commission: 0.1 },
          TRADE.fills[1]!,
        ],
      },
      isLoading: false,
      isError: false,
    } as never);
    wrap(<TradeDetailSheet tradeId="t1" onClose={vi.fn<() => void>()} />);

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.35 fee/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: FAIL — "B" chip and fee text not found (current rows render `BUY 5 @ $10.50`).

- [ ] **Step 3: Implement the new rows**

Replace the executions `<li>` body in `TradeDetailSheetBody`:

```tsx
<li
  key={f.id}
  className="-mx-2 flex items-center justify-between gap-2 rounded-control px-2 py-1.5 text-xs tabular-nums transition-colors hover:bg-bg-hover"
>
  <span className="flex items-center gap-2">
    <span
      aria-label={f.side === "buy" ? "Buy" : "Sell"}
      className={cn(
        "flex size-4 items-center justify-center rounded-control text-[10px] font-bold",
        f.side === "buy" ? "bg-tint-pos text-profit" : "bg-tint-neg text-loss",
      )}
    >
      {f.side === "buy" ? "B" : "S"}
    </span>
    <span className="text-text">
      {f.quantity} @ {fmtMoney(f.price, currency, intlLocale())}
    </span>
    {f.fees + f.commission > 0 && (
      <span className="text-text-dim">
        {fmtMoney(f.fees + f.commission, currency, intlLocale())} fee
      </span>
    )}
  </span>
  <span className="text-text-muted">{fmtWhen(f.executed_at)}</span>
</li>
```

Also tighten the `<ul>` to `className="m-0 flex list-none flex-col gap-0.5 p-0"` (rows now carry their own padding).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/TradeDetailSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/TradeDetailSheet.tsx web/src/components/TradeDetailSheet.test.tsx
git commit -m "feat(web): side chips and fees on trade drawer executions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Chart empty state as inset well (shared component)

**Files:**
- Modify: `web/src/components/charts/TradeChart.tsx:204-225` (the `!showChart` branch)
- Test: `web/src/components/charts/TradeChart.test.tsx` (new)

**Interfaces:**
- Consumes: existing `TradeChartProps` (`empty`, `errorMessage`, `error`); Lucide `ChartCandlestick`.
- Produces: nothing consumed later. Shared with the full page — visual improvement applies to both.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/charts/TradeChart.test.tsx`. `lightweight-charts` touches canvas/DOM APIs jsdom lacks, so mock the module — the empty branch never calls it:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: {},
  ColorType: { Solid: "solid" },
  createChart: vi.fn(),
  createSeriesMarkers: vi.fn(),
}));

import { TradeChart } from "./TradeChart";

describe("TradeChart empty state", () => {
  it("renders an inset well with icon and message when empty", () => {
    render(
      <TradeChart
        symbol="CL1"
        bars={[]}
        fills={[]}
        interval="1"
        empty
        errorMessage="No market data for this window."
      />,
    );
    expect(screen.getByText("No market data for this window.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /no chart data/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && vp test src/components/charts/TradeChart.test.tsx`
Expected: FAIL — no element with role `img` (message renders as a bare paragraph today).

- [ ] **Step 3: Implement the inset well**

In `TradeChart.tsx`, add `ChartCandlestick` to the `lucide-react` import, then replace the bare paragraph in the `!showChart` branch (`TradeChart.tsx:220-222`):

```tsx
<div className="flex flex-col items-center gap-2 rounded-sharp bg-bg-inset px-4 py-8">
  <ChartCandlestick
    size={18}
    strokeWidth={1.5}
    className="text-text-dim"
    role="img"
    aria-label="No chart data"
  />
  <p className="m-0 text-xs text-text-muted">
    {errorMessage ?? (error ? "Chart data unavailable." : "No chart data.")}
  </p>
</div>
```

The surrounding header row (CHART label + interval `SegmentedControl`) stays exactly as is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && vp test src/components/charts/TradeChart.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/charts/TradeChart.tsx web/src/components/charts/TradeChart.test.tsx
git commit -m "feat(web): inset-well empty state for trade chart

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Skeletons, full validation, runtime verification

**Files:**
- Modify: `web/src/components/TradeDetailSheet.tsx` (loading skeletons)

**Interfaces:**
- Consumes: everything above.
- Produces: shippable feature.

- [ ] **Step 1: Update loading skeletons**

In `TradeDetailSheet.tsx`, match the new layout heights (status line, bento block, chart, executions):

```tsx
<div className="flex flex-col gap-3 p-4">
  <Skeleton height="24px" width="60%" />
  <Skeleton height="140px" />
  <Skeleton height="200px" />
  <Skeleton height="72px" />
</div>
```

(`Skeleton` accepts `width`/`height` string props — see `web/src/components/Skeleton.tsx`.)

- [ ] **Step 2: Full web validation**

Run: `cd web && vp check && vp test`
Expected: no lint/type errors, all suites PASS.

- [ ] **Step 3: Runtime verification**

Invoke the `web:verify` project skill. Verify in the running app:
1. Open the trades table, click a closed winning trade → drawer shows title `SYM · STK · LONG/SHORT`, status line with dates, glowing bento P&L with gross−fees line, ENTRY/EXIT/QTY/HOLD/FEES cells with hairlines, executions with B/S chips.
2. Open an open trade → OPEN pill, `still open`, `—` exit, no glow crash.
3. A trade with notes/tags/setup (add via full page if the seed lacks one) → context row + 3-line clamped notes + Read more navigates to the full page.
4. A symbol without market data → inset chart well with icon.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/TradeDetailSheet.tsx
git commit -m "feat(web): drawer loading skeletons match bento layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
