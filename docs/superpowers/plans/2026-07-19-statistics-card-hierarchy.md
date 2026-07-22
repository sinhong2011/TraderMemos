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
- Hierarchy across tiers comes from type scale and spacing (Task 2), not
  from giving one tier a different cell treatment than another — all three
  tiers use the same cell variant.
- **Superseded by Task 3:** Tasks 1-2 originally kept the `variant="flush"`
  hairline technique (`gap-px bg-border`) from a pre-plan fix. Task 3
  replaces it with `variant="bento"` (elevated, borderless cells) and plain
  `gap-3` spacing, per explicit user feedback after seeing Task 2's result.
  Task 3 is the current source of truth for the cell/grid treatment; ignore
  any earlier task text that still refers to hairlines/flush as the target
  state.
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

---

### Task 3: Swap the hairline-flush technique for elevated bento cells

**Added after user feedback on Task 2's result:** seeing the tiered hairline
rows rendered, the user asked to go "back to bento grid style" — clarified
via follow-up question as: distinct raised cells with real spacing (`gap-3`),
not the flush hairline technique (`gap-px` + `bg-border`) Task 2 used. The
grouping, labels, and type-scale tiers from Task 2 are unaffected and stay
exactly as built — this task only changes the cell's own background/border
and the grid's gap technique.

**Files:**
- Modify: `web/src/components/StatCard.tsx`
- Modify: `web/src/components/StatCard.test.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`

**Interfaces:**
- Consumes: `StatCard`'s existing `variant?: "panel" | "flush"` prop (Task 1
  effectively, though `variant` itself predates this plan).
- Produces: `StatCard`'s `variant` prop becomes `"panel" | "bento"` — `"flush"`
  is removed outright (after this task, it has zero call sites: it was only
  ever used by Task 2's `SummaryMetricsGrid` code, which this task rewrites
  to use `"bento"` instead). `"panel"` (default) is unchanged — bordered,
  `var(--color-surface-panel)` background, for the two other existing
  `StatCard` call sites (`ReportsRiskDrawdown.tsx`,
  `ReportsRMultiplePerformance.tsx`), which are untouched by this task.
  `"bento"` is new: `var(--color-surface-hover)` background (one rung up the
  surface ladder from the `Card` it sits inside, so it visually pops instead
  of blending in — same elevation-ladder logic as the original double-border
  fix, just one step further this time), `var(--radius-panel)` border-radius,
  no border (elevation alone provides separation, per the borderless-design
  convention already used across this codebase).

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

  it("defaults to a bordered panel background for variant \"panel\"", () => {
    render(<StatCard label="Avg Win" value="$45.95" />);
    const cell = screen.getByText("$45.95").closest("div") as HTMLElement;
    expect(cell.style.border).toBe("1px solid var(--color-border)");
  });

  it("uses an elevated, borderless background for variant=\"bento\"", () => {
    render(<StatCard label="P&L" value="+$61.19" variant="bento" />);
    const cell = screen.getByText("+$61.19").closest("div") as HTMLElement;
    expect(cell.style.background).toBe("var(--color-surface-hover)");
    expect(cell.style.border).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify the new "bento" test fails**

Run: `vp test src/components/StatCard`
Expected: FAIL on the `variant="bento"` test (`"bento"` isn't a recognized
value yet — falls through to the bordered branch, so `cell.style.border`
is not `""`). The other 5 tests already pass on today's code.

- [ ] **Step 3: Implement the "bento" variant in `StatCard.tsx`**

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
   * spaced (gap-3+) grids. "bento" is an elevated, borderless cell (one rung
   * up the surface ladder from its typical parent Card) for use in
   * real-gap (gap-3) bento grids, where cells should read as distinct raised
   * compartments instead of blending into the parent panel behind them.
   */
  variant?: "panel" | "bento";
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
        variant === "bento"
          ? {
              background: "var(--color-surface-hover)",
              borderRadius: "var(--radius-panel)",
            }
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
Expected: PASS — 6/6.

- [ ] **Step 5: Switch `ReportsView.tsx`'s Statistics grid from hairline-flush to bento**

Two mechanical, exact-string replacements in `web/src/app/screens/ReportsView.tsx`:

```bash
sed -i '' 's/variant="flush"/variant="bento"/g' src/app/screens/ReportsView.tsx
sed -i '' 's/grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-5/grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5/' src/app/screens/ReportsView.tsx
```

The first command touches all 15 `<StatCard variant="flush" .../>` call
sites inside `SummaryMetricsGrid` (every stat in all three tiers). The
second touches the one `StatGroup` grid `className`. Nothing else in the
file should change — confirm with `git diff src/app/screens/ReportsView.tsx`
that only those lines changed (16 lines total: 15 `variant` + 1
`className`).

- [ ] **Step 6: Run the full web test suite and `vp check`**

Run: `vp test` and `vp check` from `web/`.
Expected: same pass/fail counts as before this task (the pre-existing
`PlaybookView.test.tsx`/`SettingsView.test.tsx` failures and the
pre-existing `src/routeTree.gen.ts` formatting note are unrelated —
untouched by this task) plus `StatCard.test.tsx`'s new 6/6.
`ReportsView.test.tsx` needs no changes for this task — it doesn't assert
on `variant` or grid gap classes, only on tier labels and stat text, both
unaffected by this purely visual swap.

- [ ] **Step 7: Manual visual check**

With the dev server running, navigate to `/reports` at 1440×900 and confirm:
- Each stat cell now reads as a distinct raised panel (lighter than the
  Card's own background) with visible gaps between cells — not thin
  hairlines.
- The three tier labels ("Performance", "Trade Quality", "Behavior & Costs")
  still sit correctly above their rows.
- No layout regression at a narrow width (e.g. 500px) — cells still wrap
  2-per-row without overlapping.

- [ ] **Step 8: Commit**

```bash
git add src/components/StatCard.tsx src/components/StatCard.test.tsx src/app/screens/ReportsView.tsx
git commit -m "$(cat <<'EOF'
feat(web): swap Statistics grid's hairline-flush cells for elevated
bento cells

User feedback after seeing Task 2's tiered hairline rows: wanted true
bento-box compartments (raised cells, real gaps) instead of flush
hairline strips. Replaces StatCard's now-unused "flush" variant with
"bento" (elevated one rung up the surface ladder, borderless) and
switches the Statistics grid's gap-px+bg-border hairline technique to
plain gap-3, matching the rest of the app's bento grids.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
