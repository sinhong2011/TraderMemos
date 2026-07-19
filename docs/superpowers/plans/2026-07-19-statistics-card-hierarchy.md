# Statistics Card Visual Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Reports page's flat 15-stat Statistics grid into three
labeled, visually-tiered rows (Performance / Trade Quality / Behavior &
Costs) so the card has real information hierarchy instead of uniform weight.

**Architecture:** Add a `size` prop to the existing `StatCard` component
(`"lg" | "md" | "sm"`, default `"md"` = today's unchanged look) that only
changes the value text's font size and cell padding. Add a small local
`StatGroup` wrapper inside `ReportsView.tsx` (label + the existing
`gap-px bg-border` hairline grid) and render three of them in place of
today's single flat grid.

**Tech Stack:** React + TypeScript, Tailwind v4, Vitest + Testing Library
(`vp test`), `vp check` for lint/format/typecheck. No backend or data-layer
changes.

## Global Constraints

- No new data or computation — this is a pure regrouping/restyling of stats
  already computed by `Summary` and `computeDashboardInsights`.
- `StatCard`'s two other call sites (`ReportsRiskDrawdown.tsx`,
  `ReportsRMultiplePerformance.tsx`) must render pixel-identical to today —
  they don't pass `size`, so they get the default and must resolve to the
  same `text-xl` class as before.
- No new background panels/elevation — hierarchy comes from type scale and
  spacing only (borderless/unified-void convention already used elsewhere in
  this codebase).
- Keep the existing `variant="flush"` hairline technique
  (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, `gap-px bg-border`) — no
  regression on the prior double-border fix.
- Validate every task with `vp check` and `vp test` from `web/`, run from
  `/Volumes/Pie/Sync/Workspace/dev/TraderMemos/.worktrees/reports-page-upgrade/web`.
- **All commands in this plan (`vp`, `git add`, `git commit`) assume the
  shell's cwd is that `web/` directory** — `cd` there first if starting
  fresh. File paths in each task's "Files:" section are repo-root-relative
  (matching this repo's spec/plan convention); the `git add` commands inside
  each step use `web/`-relative paths instead, since git pathspecs resolve
  against cwd, not repo root — mixing the two silently fails
  (`git add web/src/...` errors with "did not match any files" when cwd is
  already `web/`).

---

### Task 1: Add `size` prop to `StatCard`

**Files:**
- Modify: `web/src/components/StatCard.tsx`
- Test: `web/src/components/StatCard.test.tsx`

**Interfaces:**
- Produces: `StatCard({ label, value, accent?, hint?, variant?, size? })` —
  `size?: "lg" | "md" | "sm"`, default `"md"`. `"lg"` renders the value at
  `text-[26px]`; `"sm"` renders it at `text-[15px]` and reduces the cell's
  vertical padding to `py-2` (from `py-3`); `"md"` is unchanged (`text-xl`,
  `py-3`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `web/src/components/StatCard.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Net P&L" value="+$4,182.00" />);
    expect(screen.getByText("Net P&L")).toBeInTheDocument();
    expect(screen.getByText("+$4,182.00")).toBeInTheDocument();
  });

  it("defaults to the existing medium type scale", () => {
    render(<StatCard label="Avg Win" value="$45.95" />);
    expect(screen.getByText("$45.95")).toHaveClass("text-xl");
  });

  it("applies a larger type scale for size=\"lg\"", () => {
    render(<StatCard label="P&L" value="+$61.19" size="lg" />);
    expect(screen.getByText("+$61.19")).toHaveClass("text-[26px]");
  });

  it("applies a smaller type scale for size=\"sm\"", () => {
    render(<StatCard label="Breakeven" value="0" size="sm" />);
    expect(screen.getByText("0")).toHaveClass("text-[15px]");
  });
});
```

- [ ] **Step 2: Run tests to verify the three new ones fail**

Run: `vp test src/components/StatCard`
Expected: FAIL — `size` is not a recognized prop yet (TypeScript error) and
`text-[26px]` / `text-[15px]` classes aren't present.

- [ ] **Step 3: Implement `size` in `StatCard.tsx`**

Replace the full contents of `web/src/components/StatCard.tsx` with:

```tsx
import { cn } from "../lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  accent?: "pos" | "neg" | "none";
  hint?: string;
  /**
   * "panel" (default) is a self-contained bordered card, for use in loosely
   * spaced (gap-3+) grids. "flush" drops its own border/radius so it sits
   * seamlessly inside a parent hairline grid (gap-px + bg-border) instead of
   * double-bordering against the parent's hairlines.
   */
  variant?: "panel" | "flush";
  /**
   * Value type scale. "md" (default) is the original 20px size used by every
   * StatCard outside the Statistics card's tiered layout — do not change its
   * output class, other call sites depend on it staying "text-xl". "lg" and
   * "sm" exist only for that tiered layout's Performance / Behavior & Costs
   * rows.
   */
  size?: "lg" | "md" | "sm";
}

function accentColor(accent?: "pos" | "neg" | "none"): string {
  if (accent === "pos") return "var(--color-pos)";
  if (accent === "neg") return "var(--color-neg)";
  return "var(--color-text)";
}

function valueSizeClass(size: "lg" | "md" | "sm"): string {
  if (size === "lg") return "text-[26px]";
  if (size === "sm") return "text-[15px]";
  return "text-xl";
}

export function StatCard({
  label,
  value,
  accent,
  hint,
  variant = "panel",
  size = "md",
}: StatCardProps) {
  return (
    <div
      className={cn("flex flex-col gap-1 px-4", size === "sm" ? "py-2" : "py-3")}
      style={
        variant === "flush"
          ? { background: "var(--color-surface-panel)" }
          : {
              background: "var(--color-surface-panel)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-panel)",
            }
      }
    >
      <span
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className={cn(valueSizeClass(size), "font-semibold leading-none")}
        style={{
          color: accentColor(accent),
          transition: "color var(--duration-fast)",
        }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vp test src/components/StatCard`
Expected: PASS — 4 tests.

- [ ] **Step 5: Run `vp check` for typecheck/lint**

Run: `vp check`
Expected: no new errors (a pre-existing `src/routeTree.gen.ts` formatting
warning is unrelated and may still appear — ignore it).

- [ ] **Step 6: Commit**

```bash
git add src/components/StatCard.tsx src/components/StatCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add size prop to StatCard for tiered type scale

Enables the Statistics card's upcoming three-tier layout (Performance/
Trade Quality/Behavior & Costs) without touching the two other
StatCard call sites, which get the unchanged default.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Regroup `SummaryMetricsGrid` into three labeled tiers

**Files:**
- Modify: `web/src/app/screens/ReportsView.tsx`
- Test: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `StatCard({ label, value, accent?, hint?, variant?, size? })`
  from Task 1.
- Produces: `SummaryMetricsGrid` now renders three `StatGroup` sections
  (local, non-exported) instead of one flat grid; no change to
  `SummaryMetricsGrid`'s own props or to `ReportsView`'s exported surface.

- [ ] **Step 1: Write the failing test**

In `web/src/app/screens/ReportsView.test.tsx`, extend the existing
`"renders the summary metrics grid"` test (do not add a new `it` block —
extend the existing one) so it also asserts the three tier labels:

```tsx
  it("renders the summary metrics grid", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[grp("AAPL", 200)]}
        summary={grp("all", 60).summary}
      />,
    );
    // Selector-scoped: the Metric Evolution card's right-axis metric selector
    // also has "Profit Factor" / "Expectancy" options (as buttons), which a
    // plain text match would ambiguously match alongside the StatCard labels.
    expect(screen.getByText("Profit Factor", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Expectancy", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();
    expect(screen.getByText("Trade Quality")).toBeInTheDocument();
    expect(screen.getByText("Behavior & Costs")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify the new assertions fail**

Run: `vp test src/app/screens/ReportsView`
Expected: FAIL — "Performance" / "Trade Quality" / "Behavior & Costs" text
not found.

- [ ] **Step 3: Add `StatGroup` and regroup `SummaryMetricsGrid`**

In `web/src/app/screens/ReportsView.tsx`, add this local component directly
above `function SummaryMetricsGrid(` (same file, no new import needed beyond
`ReactNode`, which is not currently imported — add
`import type { ReactNode } from "react";` to the top import block):

```tsx
function StatGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5">
        {children}
      </div>
    </div>
  );
}
```

Then replace the body of `SummaryMetricsGrid`'s `return (...)` — the single
`<div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3 lg:grid-cols-5">...</div>`
— with:

```tsx
  return (
    <div className="border-b border-border">
      <StatGroup label="Performance">
        <StatCard
          variant="flush"
          size="lg"
          label="P&L"
          value={fmtSignedMoney(summary.net_pnl * fxRate, currency, locale)}
          accent={summary.net_pnl >= 0 ? "pos" : "neg"}
          hint={`Gross ${fmtSignedMoney((summary.gross_profit + summary.gross_loss) * fxRate, currency, locale)} · Fees ${fmtMoney(summary.total_fees * fxRate, currency, locale)} (${feePct.toFixed(1)}%)`}
        />
        <StatCard
          variant="flush"
          size="lg"
          label="Win Rate"
          value={fmtPct(summary.win_rate, locale)}
          accent="none"
        />
        <StatCard
          variant="flush"
          size="lg"
          label="Profit Factor"
          value={summary.profit_factor > 0 ? summary.profit_factor.toFixed(2) : "—"}
        />
        <StatCard variant="flush" size="lg" label="Total Trades" value={String(summary.total_trades)} />
        <StatCard
          variant="flush"
          size="lg"
          label="Expectancy"
          value={fmtSignedMoney(summary.expectancy * fxRate, currency, locale)}
          accent={summary.expectancy >= 0 ? "pos" : "neg"}
        />
      </StatGroup>
      <StatGroup label="Trade Quality">
        <StatCard
          variant="flush"
          label="Avg Win"
          value={fmtMoney(summary.avg_win * fxRate, currency, locale)}
          accent="pos"
        />
        <StatCard
          variant="flush"
          label="Avg Loss"
          value={fmtMoney(summary.avg_loss * fxRate, currency, locale)}
          accent="neg"
        />
        <StatCard
          variant="flush"
          label="Largest Win"
          value={fmtMoney(summary.largest_win * fxRate, currency, locale)}
          accent="pos"
        />
        <StatCard
          variant="flush"
          label="Largest Loss"
          value={fmtMoney(summary.largest_loss * fxRate, currency, locale)}
          accent="neg"
        />
        <StatCard
          variant="flush"
          label="Avg Trade"
          value={fmtSignedMoney(summary.avg_trade * fxRate, currency, locale)}
          accent={summary.avg_trade >= 0 ? "pos" : "neg"}
        />
      </StatGroup>
      <StatGroup label="Behavior & Costs">
        <StatCard
          variant="flush"
          size="sm"
          label="Avg Win Hold"
          value={fmtDuration(insights.winHoldSecs)}
          accent="pos"
        />
        <StatCard
          variant="flush"
          size="sm"
          label="Avg Loss Hold"
          value={fmtDuration(insights.lossHoldSecs)}
          accent="neg"
        />
        <StatCard variant="flush" size="sm" label="Breakeven" value={String(summary.breakeven)} />
        <StatCard
          variant="flush"
          size="sm"
          label="Best Streak"
          value={insights.bestStreak > 0 ? `${insights.bestStreak} trades` : "—"}
          accent="pos"
        />
        <StatCard
          variant="flush"
          size="sm"
          label="Total Fees"
          value={fmtMoney(summary.total_fees * fxRate, currency, locale)}
          accent="neg"
        />
      </StatGroup>
    </div>
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vp test src/app/screens/ReportsView`
Expected: PASS.

- [ ] **Step 5: Run the full web test suite and `vp check`**

Run: `vp test` and `vp check` from `web/`.
Expected: same pass/fail counts as the pre-existing baseline (`PlaybookView.test.tsx`
and `SettingsView.test.tsx` were already failing before this change due to a
missing `QueryClientProvider` wrapper, unrelated to this work — do not fix
those here) plus the new/updated `StatCard.test.tsx` and
`ReportsView.test.tsx` assertions passing. `vp check` shows no new errors
beyond the pre-existing `src/routeTree.gen.ts` formatting note.

- [ ] **Step 6: Manual visual check**

With the dev server running (`http://localhost:5173`, dev sign-in if
prompted), navigate to `/reports` at a 1440×900 viewport and confirm:
- Three tier labels visible above their rows ("Performance", "Trade
  Quality", "Behavior & Costs").
- Performance row values visibly larger than Trade Quality; Behavior & Costs
  visibly smaller/denser than both.
- No orphaned/empty cells in any row at the `lg` (5-col) breakpoint.
- Resize to a narrow width (e.g. 500px) and confirm each tier still wraps
  sanely (2-col grid) without overlapping the group label above it.

- [ ] **Step 7: Commit**

```bash
git add src/app/screens/ReportsView.tsx src/app/screens/ReportsView.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): tier the Statistics card into Performance/Trade Quality/
Behavior & Costs

Replaces the flat 15-stat equal-weight grid with three labeled,
type-scaled rows so the card has real information hierarchy, per
DESIGN.md's "numbers are the hero" / "asymmetric bento, not equal card
grid" guidance. Regroups Avg Trade into Trade Quality and the hold-time
stats into Behavior & Costs, alongside Breakeven/Best Streak/Total Fees.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
