# Reports Insight Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Reports page's `ReportsInsightWidgets` from flat progress bars to a polished arc-fill profit-factor gauge, a win/loss donut, and a unified avg-win-vs-loss split bar.

**Architecture:** Two new pure, presentational SVG primitives (`GaugeArc`, `DonutRing`) under `web/src/components/charts/`, driven only by props. `ReportsInsightWidgets` composes them from the existing `Summary` object. All SVG uses `pathLength={100}` so stroke-dash math is a plain percentage — deterministic and unit-testable. No recharts, no backend.

**Tech Stack:** React + TypeScript, Tailwind (design tokens as CSS vars), inline SVG, `vite-plus/test` (`vp test run`) + `@testing-library/react`.

## Global Constraints

- Pure inline SVG only for these widgets — do **not** add or use recharts here.
- No backend, API, route, or `types.ts` changes. Data comes solely from the existing `Summary` object.
- Use existing CSS-var tokens only: `--color-profit` (#4ade80), `--color-loss` (#fb7185), `--color-signal` (#a78bfa), `--color-bg-inset` (#121218), `--color-text-muted`. No new tokens.
- Primitives stay pure/presentational (props in → SVG out); no data or business logic inside them.
- Every SVG arc/segment path uses `pathLength={100}` so dash values are percentages.
- TDD: write the failing test first. Run tests with `npm --prefix web test` (alias for `vp test run`). Type + lint check: `npm --prefix web run lint` (or `npx --prefix web tsc --noEmit`).
- Test imports use `import { describe, expect, it } from "vite-plus/test";` (match existing tests).
- Keep the existing `WidgetShell` and the `grid grid-cols-2 lg:grid-cols-4` layout. Preserve the four widget titles: "Profit factor", "Winning vs losing", "Avg win vs avg loss", "Payoff ratio".

---

### Task 1: `GaugeArc` primitive

**Files:**
- Create: `web/src/components/charts/GaugeArc.tsx`
- Test: `web/src/components/charts/GaugeArc.test.tsx`

**Interfaces:**
- Consumes: nothing (leaf component).
- Produces:
  ```ts
  interface GaugeArcProps {
    value: number;            // 0..1 fraction of the arc that is filled (clamped)
    children?: React.ReactNode; // centered overlay content (e.g. the PF number)
    className?: string;
    gradientId?: string;      // default "gauge-grad"
  }
  export function GaugeArc(props: GaugeArcProps): JSX.Element
  ```
  Renders a `<path data-testid="gauge-fill">` whose `stroke-dashoffset` attribute equals `100 * (1 - clamp(value,0,1))`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/charts/GaugeArc.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { GaugeArc } from "./GaugeArc";

describe("GaugeArc", () => {
  it("fills half the arc for value 0.5", () => {
    render(<GaugeArc value={0.5} />);
    const fill = screen.getByTestId("gauge-fill");
    expect(fill.getAttribute("stroke-dashoffset")).toBe("50");
  });

  it("shows an empty arc for value 0 and a full arc for value 1", () => {
    const { rerender } = render(<GaugeArc value={0} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    rerender(<GaugeArc value={1} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("clamps out-of-range values", () => {
    const { rerender } = render(<GaugeArc value={-2} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    rerender(<GaugeArc value={5} />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("0");
  });

  it("renders centered children", () => {
    render(<GaugeArc value={0.5}>1.71</GaugeArc>);
    expect(screen.getByText("1.71")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web test -- GaugeArc`
Expected: FAIL — cannot resolve `./GaugeArc`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/components/charts/GaugeArc.tsx
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface GaugeArcProps {
  value: number;
  children?: ReactNode;
  className?: string;
  gradientId?: string;
}

// Semicircle path from left (6,50) to right (94,50), radius 44, opening upward.
const ARC_PATH = "M 6 50 A 44 44 0 0 1 94 50";

/** Arc-fill gauge: a 180° track that fills left→right to `value` (0..1). */
export function GaugeArc({ value, children, className, gradientId = "gauge-grad" }: GaugeArcProps) {
  const v = Math.max(0, Math.min(1, value));
  const dashOffset = 100 * (1 - v);
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox="0 0 100 54" className="w-full" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-loss)" />
            <stop offset="50%" stopColor="var(--color-signal)" />
            <stop offset="100%" stopColor="var(--color-profit)" />
          </linearGradient>
        </defs>
        <path
          d={ARC_PATH}
          fill="none"
          stroke="var(--color-bg-inset)"
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          data-testid="gauge-fill"
          d={ARC_PATH}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 300ms ease" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web test -- GaugeArc`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/charts/GaugeArc.tsx web/src/components/charts/GaugeArc.test.tsx
git commit -m "feat(web): add GaugeArc SVG primitive for reports gauge"
```

---

### Task 2: `DonutRing` primitive

**Files:**
- Create: `web/src/components/charts/DonutRing.tsx`
- Test: `web/src/components/charts/DonutRing.test.tsx`

**Interfaces:**
- Consumes: nothing (leaf component).
- Produces:
  ```ts
  interface DonutSegment { value: number; color: string }
  interface DonutRingProps {
    segments: DonutSegment[];
    children?: React.ReactNode; // centered hole content
    className?: string;
    strokeWidth?: number;       // default 12
  }
  export function DonutRing(props: DonutRingProps): JSX.Element
  ```
  Each drawn segment is a `<circle data-testid="donut-seg">` with `stroke-dasharray="<len> <100-len>"` where `len` is the segment's percentage of the total. When the total is 0, no `donut-seg` circles are rendered (only the muted track).

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/components/charts/DonutRing.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { DonutRing } from "./DonutRing";

describe("DonutRing", () => {
  it("sizes each segment proportionally to its value", () => {
    render(
      <DonutRing
        segments={[
          { value: 12, color: "var(--color-profit)" },
          { value: 8, color: "var(--color-loss)" },
        ]}
      />,
    );
    const segs = screen.getAllByTestId("donut-seg");
    expect(segs).toHaveLength(2);
    expect(segs[0].getAttribute("stroke-dasharray")).toBe("60 40");
    expect(segs[1].getAttribute("stroke-dasharray")).toBe("40 60");
  });

  it("renders no segments when the total is zero", () => {
    render(<DonutRing segments={[{ value: 0, color: "var(--color-profit)" }]} />);
    expect(screen.queryAllByTestId("donut-seg")).toHaveLength(0);
  });

  it("renders centered children in the hole", () => {
    render(
      <DonutRing segments={[{ value: 1, color: "var(--color-profit)" }]}>
        <span>60%</span>
      </DonutRing>,
    );
    expect(screen.getByText("60%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix web test -- DonutRing`
Expected: FAIL — cannot resolve `./DonutRing`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/components/charts/DonutRing.tsx
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface DonutSegment {
  value: number;
  color: string;
}

export interface DonutRingProps {
  segments: DonutSegment[];
  children?: ReactNode;
  className?: string;
  strokeWidth?: number;
}

/** Donut chart: chained stroke-dasharray arcs on a shared circle, hole content centered. */
export function DonutRing({ segments, children, className, strokeWidth = 12 }: DonutRingProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  let acc = 0;
  return (
    <div className={cn("relative w-full", className)}>
      <svg viewBox="0 0 100 100" className="w-full -rotate-90" role="presentation">
        <circle
          cx={50}
          cy={50}
          r={40}
          fill="none"
          stroke="var(--color-bg-inset)"
          strokeWidth={strokeWidth}
          pathLength={100}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            const len = (Math.max(0, seg.value) / total) * 100;
            const offset = -acc;
            acc += len;
            if (len === 0) return null;
            return (
              <circle
                key={i}
                data-testid="donut-seg"
                cx={50}
                cy={50}
                r={40}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                pathLength={100}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dasharray 300ms ease" }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix web test -- DonutRing`
Expected: PASS (3 tests).

Note: the `len === 0` guard means a zero-value segment inside a non-zero total is skipped, so `getAllByTestId("donut-seg")` counts only visible segments. The Task 3 tests rely on this (breakeven 0 → 2 segments).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/charts/DonutRing.tsx web/src/components/charts/DonutRing.test.tsx
git commit -m "feat(web): add DonutRing SVG primitive for reports donut"
```

---

### Task 3: Rework `ReportsInsightWidgets` to use gauge, donut, and split bar

**Files:**
- Modify: `web/src/components/ReportsInsightWidgets.tsx`
- Modify: `web/src/components/ReportsInsightWidgets.test.tsx`

**Interfaces:**
- Consumes: `GaugeArc` from `./charts/GaugeArc`, `DonutRing`/`DonutSegment` from `./charts/DonutRing`. Existing props (`summary`, `currency`, `fxRate`) unchanged.
- Produces: no new exported API (same `ReportsInsightWidgets` signature).

- [ ] **Step 1: Write the failing tests (extend existing file)**

Replace the body of `web/src/components/ReportsInsightWidgets.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { Summary } from "../lib/api/types";
import { ReportsInsightWidgets } from "./ReportsInsightWidgets";

const summary: Summary = {
  total_trades: 20,
  wins: 12,
  losses: 8,
  breakeven: 0,
  win_rate: 0.6,
  net_pnl: 500,
  gross_profit: 1200,
  gross_loss: 700,
  profit_factor: 1.71,
  expectancy: 25,
  avg_win: 100,
  avg_loss: 87.5,
  avg_trade: 25,
  largest_win: 200,
  largest_loss: 150,
  total_fees: 20,
};

describe("ReportsInsightWidgets", () => {
  it("renders all four widget titles", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    expect(screen.getByText("Profit factor")).toBeInTheDocument();
    expect(screen.getByText("Winning vs losing")).toBeInTheDocument();
    expect(screen.getByText("Avg win vs avg loss")).toBeInTheDocument();
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
  });

  it("maps profit factor onto the gauge fill (pf/3, capped)", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    // pf 1.71 -> fraction 0.57 -> dashoffset 100*(1-0.57)=43 (rounded)
    const fill = screen.getByTestId("gauge-fill");
    const offset = Number(fill.getAttribute("stroke-dashoffset"));
    expect(offset).toBeGreaterThan(42);
    expect(offset).toBeLessThan(44);
    expect(screen.getByText("1.71")).toBeInTheDocument();
  });

  it("draws a win/loss donut and shows the win rate in the hole", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    const segs = screen.getAllByTestId("donut-seg");
    expect(segs).toHaveLength(2); // wins + losses, breakeven 0 skipped
    expect(segs[0].getAttribute("stroke-dasharray")).toBe("60 40");
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders both dollar values in the avg-win-vs-loss split bar", () => {
    render(<ReportsInsightWidgets summary={summary} currency="USD" />);
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$87.50")).toBeInTheDocument();
  });

  it("handles a zero-trade summary without crashing", () => {
    const empty: Summary = {
      ...summary,
      total_trades: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      profit_factor: 0,
      avg_win: 0,
      avg_loss: 0,
    };
    render(<ReportsInsightWidgets summary={empty} currency="USD" />);
    expect(screen.getByTestId("gauge-fill").getAttribute("stroke-dashoffset")).toBe("100");
    expect(screen.queryAllByTestId("donut-seg")).toHaveLength(0);
    expect(screen.getByText("Payoff ratio")).toBeInTheDocument();
  });
});
```

Note: confirm `fmtPct(0.6)` renders `"60%"` and `fmtMoney(100, "USD")` renders `"$100.00"` in this repo. Run `npm --prefix web test -- format` or grep `web/src/lib/format.ts`; if the exact strings differ (e.g. `"60.0%"`), update the expected literals in these tests to match before proceeding.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix web test -- ReportsInsightWidgets`
Expected: FAIL — no `gauge-fill` / `donut-seg` test ids yet (flat bars still rendered).

- [ ] **Step 3: Implement the rework**

Edit `web/src/components/ReportsInsightWidgets.tsx`:

3a. Add imports near the top (after the existing `WinLossRecord` import):

```tsx
import { GaugeArc } from "./charts/GaugeArc";
import { DonutRing } from "./charts/DonutRing";
```

3b. Inside the component, after the existing derived values, add:

```tsx
  const pfFraction = pf <= 0 ? 0 : Math.min(1, pf / 3);
  const winLossTotal = avgWin + avgLoss;
  const winBarPct = winLossTotal > 0 ? (avgWin / winLossTotal) * 100 : 0;
```

3c. Replace the **Profit factor** `<WidgetShell>` block with:

```tsx
      <WidgetShell title="Profit factor">
        <GaugeArc value={pfFraction} className="min-h-[96px]">
          <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-text">
            {pf > 0 ? pf.toFixed(2) : "—"}
          </span>
        </GaugeArc>
        <p className="mt-1 text-center text-[9px] text-text-dim">1.0 = break-even edge</p>
      </WidgetShell>
```

3d. Replace the **Winning vs losing** `<WidgetShell>` block with:

```tsx
      <WidgetShell title="Winning vs losing">
        <DonutRing
          className="mx-auto max-w-[112px]"
          segments={[
            { value: summary.wins, color: "var(--color-profit)" },
            { value: summary.losses, color: "var(--color-loss)" },
            { value: summary.breakeven, color: "var(--color-text-muted)" },
          ]}
        >
          <span className="text-[18px] font-semibold leading-none tabular-nums text-text">
            {fmtPct(summary.win_rate, locale)}
          </span>
          <WinLossRecord
            wins={summary.wins}
            losses={summary.losses}
            separator=" / "
            className="mt-1 text-[11px]"
          />
        </DonutRing>
      </WidgetShell>
```

3e. Replace the **Avg win vs avg loss** `<WidgetShell>` block with:

```tsx
      <WidgetShell title="Avg win vs avg loss">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold tabular-nums text-profit">
            {fmtMoney(money(avgWin), currency, locale)}
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-loss">
            {fmtMoney(money(avgLoss), currency, locale)}
          </span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-bg-inset">
          {winLossTotal > 0 ? (
            <>
              <div className="bg-profit" style={{ width: `${winBarPct}%` }} />
              <div className="bg-loss" style={{ width: `${100 - winBarPct}%` }} />
            </>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between text-[9px] text-text-muted">
          <span>Avg win</span>
          <span>Avg loss</span>
        </div>
      </WidgetShell>
```

3f. Leave the **Payoff ratio** `<WidgetShell>` block unchanged. Remove now-unused locals only if the linter flags them: the old `winShare`, `lossShare`, `maxEdge`, `pfBar` are no longer referenced — delete those `const` lines to keep `tsc`/lint clean.

- [ ] **Step 4: Run tests + typecheck to verify green**

Run: `npm --prefix web test -- ReportsInsightWidgets GaugeArc DonutRing`
Expected: PASS (all).
Run: `npm --prefix web run lint`
Expected: no new errors in these files.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportsInsightWidgets.tsx web/src/components/ReportsInsightWidgets.test.tsx
git commit -m "feat(web): upgrade reports insight widgets to gauge, donut, split bar"
```

---

### Task 4: Runtime verification

**Files:** none (verification only).

- [ ] **Step 1: Full test + typecheck sweep**

Run: `npm --prefix web test`
Expected: whole suite passes (no regressions).
Run: `npm --prefix web run lint`
Expected: clean (no new errors).

- [ ] **Step 2: Drive the app with the `web:verify` skill**

Invoke the `web:verify` skill. Open the Reports page and confirm, at both mobile and desktop widths and in both light and dark themes:
- Profit-factor gauge arc fills toward the PF value; the number sits inside the arc.
- Win/loss donut renders with the win-rate % centered in the hole.
- Avg-win-vs-loss split bar shows both dollar values with proportional green/rose segments.
- No console errors.

- [ ] **Step 3: Commit any verification fixups** (only if changes were needed)

```bash
git add -A
git commit -m "fix(web): reports insight widget verification fixups"
```

---

## Self-Review Notes

- **Spec coverage:** Gauge (Task 1/3c), donut (Task 2/3d), unified split bar (3e), Payoff unchanged (3f), pure SVG primitives under `charts/` (Tasks 1–2), TDD tests incl. edge cases 0-trades/PF=0/avgLoss (Task 3 tests), pure/prop-driven (no `Summary` mutation), no backend — all covered.
- **Placeholder scan:** none — every code step is complete. The two "confirm the exact formatted string" / "delete unused locals" notes are explicit conditional instructions, not deferred work.
- **Type consistency:** `GaugeArc({ value, children, className, gradientId })` and `DonutRing({ segments, children, className, strokeWidth })` with `DonutSegment { value, color }` are used identically in Task 3. Test ids `gauge-fill` / `donut-seg` match between primitive tests and widget tests.
