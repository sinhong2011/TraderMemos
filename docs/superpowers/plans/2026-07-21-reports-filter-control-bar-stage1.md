# Reports Filter Bar — Stage 1 (Side/Duration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Side (long/short) and Duration (scalp/day/swing) filters to the Reports analytics — a backend filter extension plus a control bar with the two selectors, driven by URL search params.

**Architecture:** The `analytics` package gains a `DurationBucket` helper (it owns the ET session clock). `Filters` gains `Side`/`Duration`, parsed and validated in `parseFilters` and applied in a new `matchTrade` predicate used by `loadClosedTrades`; all analytics endpoints inherit it. The frontend adds `side`/`duration` to the `Filters` type (serialized by `qs`), a `ReportsControlBar` component, and route wiring that reads the two from `?side=`/`?dur=` and merges them into the analytics filter object.

**Tech Stack:** Go (echo, testify), React + TypeScript, TanStack Router, vite-plus/test.

## Global Constraints

- Package manager is **bun**: `bun run test <name>`, `bun run lint` (typecheck+lint). Go tests: `cd api && go test ./...`. NOT npm.
- Backend directions are `"long"`/`"short"`; duration buckets are `"scalp"|"day"|"swing"`; the scalp cutoff is a named const `ScalpMaxSecs = 600` (10 min). Calendar-day comparison uses the ET session clock (`America/New_York`).
- Duration semantics: **swing** = closed on a later ET calendar day than opened; **scalp** = same ET day and `time_in_trade < 600s`; **day** = same ET day and (`≥ 600s` or unknown duration).
- URL params (all optional, coerce unknown → default): `side` (`all|long|short`, default `all`), `dur` (`all|scalp|day|swing`, default `all`). `"all"` is sent to the API as an omitted param (no filtering).
- Reuse existing primitives: `SegmentedControl`, the `Tabs*` primitives, `qs`, the `useAnalytics` hooks. No new deps.

---

### Task 1: Backend Side/Duration filter

**Files:**
- Create: `api/internal/analytics/duration.go`, `api/internal/analytics/duration_test.go`
- Modify: `api/internal/api/filters.go`, `api/internal/api/dto.go`
- Test: `api/internal/api/breakdown_handler_test.go`

**Interfaces:**
- Produces: `analytics.DurationBucket(openedAt, closedAt time.Time, timeInTradeSecs *int64) string` and `analytics.ScalpMaxSecs`; `Filters.Side`, `Filters.Duration`, and `Filters.matchTrade(t store.Trade) bool`.

- [ ] **Step 1: Write the failing analytics test**

Create `api/internal/analytics/duration_test.go`:

```go
package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestDurationBucket(t *testing.T) {
	p := func(s string) time.Time {
		ts, err := time.Parse(time.RFC3339, s)
		require.NoError(t, err)
		return ts
	}
	secs := func(n int64) *int64 { return &n }

	// Opened 14:00 ET, closed 21:00 ET SAME ET day (both 2026-01-02 ET) → not swing.
	openSameDay := p("2026-01-02T19:00:00Z")  // 14:00 ET
	closeSameDay := p("2026-01-03T02:00:00Z") // 21:00 ET, still Jan 2 ET
	require.Equal(t, "day", DurationBucket(openSameDay, closeSameDay, secs(7200)))
	require.Equal(t, "scalp", DurationBucket(openSameDay, closeSameDay, secs(300)))
	require.Equal(t, "day", DurationBucket(openSameDay, closeSameDay, nil)) // unknown duration → day

	// Closed on a later ET calendar day → swing regardless of secs.
	openD1 := p("2026-01-02T15:00:00Z")  // 10:00 ET Jan 2
	closeD2 := p("2026-01-05T15:00:00Z") // 10:00 ET Jan 5
	require.Equal(t, "swing", DurationBucket(openD1, closeD2, secs(120)))
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api && go test ./internal/analytics/ -run TestDurationBucket -v`
Expected: FAIL — `DurationBucket` undefined.

- [ ] **Step 3: Implement `DurationBucket`**

Create `api/internal/analytics/duration.go`:

```go
package analytics

import "time"

// ScalpMaxSecs is the upper bound (exclusive) for a same-day trade to count as a scalp.
const ScalpMaxSecs = 600

// DurationBucket classifies a closed trade by holding period, using the ET
// session clock for the calendar-day comparison:
//   - "swing": closed on a later ET calendar day than opened (held overnight)
//   - "scalp": same ET day and time in trade < ScalpMaxSecs
//   - "day":   same ET day and (>= ScalpMaxSecs, or duration unknown)
func DurationBucket(openedAt, closedAt time.Time, timeInTradeSecs *int64) string {
	o := openedAt.In(sessionLoc)
	c := closedAt.In(sessionLoc)
	if o.Year() != c.Year() || o.YearDay() != c.YearDay() {
		return "swing"
	}
	if timeInTradeSecs != nil && *timeInTradeSecs < ScalpMaxSecs {
		return "scalp"
	}
	return "day"
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd api && go test ./internal/analytics/ -run TestDurationBucket -v`
Expected: PASS.

- [ ] **Step 5: Write the failing handler test**

Add to `api/internal/api/breakdown_handler_test.go`:

```go
func TestBreakdownBySideDuration(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "sd@x.com")
	acc := accountID(t, s, tok)

	mk := func(sym, side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, sym, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	// AAPL: long scalp — buy 10:00, sell 10:05 (same ET day, 300s).
	mk("AAPL", "buy", 100, 10, "2026-01-02T15:00:00Z")
	mk("AAPL", "sell", 100, 11, "2026-01-02T15:05:00Z")
	// MSFT: long swing — buy day 1, sell day 3.
	mk("MSFT", "buy", 50, 20, "2026-01-02T15:00:00Z")
	mk("MSFT", "sell", 50, 22, "2026-01-05T15:00:00Z")

	// side=long & duration=scalp → only AAPL.
	rec := do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&side=long&duration=scalp&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key string `json:"key"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 1)
	require.Equal(t, "AAPL", out[0].Key)

	// invalid side → 400
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&side=bogus", "", tok).Code)
	// invalid duration → 400
	require.Equal(t, http.StatusBadRequest,
		do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=symbol&duration=bogus", "", tok).Code)
}
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd api && go test ./internal/api/ -run TestBreakdownBySideDuration -v`
Expected: FAIL — `side`/`duration` are ignored, so both trades return (len 2), and invalid values are not rejected.

- [ ] **Step 7: Extend `Filters` + `parseFilters` + add `matchTrade`**

In `api/internal/api/filters.go`, add the two fields to the `Filters` struct (after `Status`):

```go
	Side     string // "" = all, "long" | "short"
	Duration string // "" = all, "scalp" | "day" | "swing"
```

Add validation in `parseFilters` (after the `status` block, before the `from` block):

```go
	f.Side = c.QueryParam("side")
	if f.Side != "" && f.Side != "long" && f.Side != "short" {
		return f, fmt.Errorf("invalid 'side' (want long|short)")
	}
	f.Duration = c.QueryParam("duration")
	if f.Duration != "" && f.Duration != "scalp" && f.Duration != "day" && f.Duration != "swing" {
		return f, fmt.Errorf("invalid 'duration' (want scalp|day|swing)")
	}
```

Add the import block for `store` and `analytics`, and two predicates at the end of the file. `matchSideDuration` is shared by both the closed-trade (analytics) and the trade-log load paths so the whole Reports page filters consistently; `matchTrade` layers it onto the existing closed-trade symbol/date check:

```go
// matchSideDuration applies the Side/Duration filters to a trade. Open trades
// (no valid close) pass the Side check but fail any Duration filter, since a
// holding-period bucket requires a close.
func (f Filters) matchSideDuration(t store.Trade) bool {
	if f.Side == "long" && t.Direction != "long" {
		return false
	}
	if f.Side == "short" && t.Direction != "short" {
		return false
	}
	if f.Duration != "" {
		if !t.ClosedAt.Valid {
			return false
		}
		var secs *int64
		if t.TimeInTradeSecs.Valid {
			v := t.TimeInTradeSecs.Int64
			secs = &v
		}
		if analytics.DurationBucket(t.OpenedAt, t.ClosedAt.Time, secs) != f.Duration {
			return false
		}
	}
	return true
}

// matchTrade layers Side/Duration (and the existing symbol/date checks) onto a
// closed trade. Trades without a valid close are excluded.
func (f Filters) matchTrade(t store.Trade) bool {
	if !t.ClosedAt.Valid || !f.matchClosed(t.Symbol, t.ClosedAt.Time) {
		return false
	}
	return f.matchSideDuration(t)
}
```

Update the `filters.go` imports to:

```go
import (
	"fmt"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/store"
)
```

- [ ] **Step 8: Apply the filters in both load paths**

In `api/internal/api/dto.go`, change the filter loop in `loadClosedTrades` from:

```go
	for _, t := range rows {
		if t.ClosedAt.Valid && f.matchClosed(t.Symbol, t.ClosedAt.Time) {
			out = append(out, t)
		}
	}
```

to:

```go
	for _, t := range rows {
		if f.matchTrade(t) {
			out = append(out, t)
		}
	}
```

And in `loadTrades` (same file), layer Side/Duration onto the existing `matchOpened` check so the trades-based Reports cards (Rolling Win-Rate, Metric Evolution, Risk/Drawdown) filter consistently. Change:

```go
	for _, t := range rows {
		if f.matchOpened(t.Symbol, t.OpenedAt) {
			out = append(out, t)
		}
	}
```

to:

```go
	for _, t := range rows {
		if f.matchOpened(t.Symbol, t.OpenedAt) && f.matchSideDuration(t) {
			out = append(out, t)
		}
	}
```

(The trade log and dashboard never pass `side`/`duration`, so their behavior is unchanged — `matchSideDuration` returns true when both are empty.)

- [ ] **Step 9: Run both tests + full API suite**

Run: `cd api && go test ./internal/analytics/ ./internal/api/ -run 'TestDurationBucket|TestBreakdownBySideDuration' -v && go test ./...`
Expected: the two tests PASS; full suite PASS.

- [ ] **Step 10: Commit**

```bash
git add api/internal/analytics/duration.go api/internal/analytics/duration_test.go api/internal/api/filters.go api/internal/api/dto.go api/internal/api/breakdown_handler_test.go
git commit -m "feat(api): add side + duration analytics filters (SP5 stage 1)"
```

---

### Task 2: `ReportsControlBar` component

**Files:**
- Create: `web/src/components/ReportsControlBar.tsx`
- Test: `web/src/components/ReportsControlBar.test.tsx`

**Interfaces:**
- Consumes: `SegmentedControl`.
- Produces: `export type ReportsSide = "all" | "long" | "short";`, `export type ReportsDuration = "all" | "scalp" | "day" | "swing";`, and `export function ReportsControlBar(props: ReportsControlBarProps)` with `export interface ReportsControlBarProps { side: ReportsSide; duration: ReportsDuration; onSideChange: (s: ReportsSide) => void; onDurationChange: (d: ReportsDuration) => void }`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/ReportsControlBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ReportsControlBar } from "./ReportsControlBar";

const base = {
  side: "all" as const,
  duration: "all" as const,
  onSideChange: vi.fn(),
  onDurationChange: vi.fn(),
};

describe("ReportsControlBar", () => {
  it("renders the side and duration options", () => {
    render(<ReportsControlBar {...base} />);
    expect(screen.getByRole("tab", { name: "Long" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Short" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scalp" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Swing" })).toBeInTheDocument();
  });

  it("calls onSideChange when a side is picked", () => {
    const onSideChange = vi.fn();
    render(<ReportsControlBar {...base} onSideChange={onSideChange} />);
    screen.getByRole("tab", { name: "Long" }).click();
    expect(onSideChange).toHaveBeenCalledWith("long");
  });

  it("calls onDurationChange when a duration is picked", () => {
    const onDurationChange = vi.fn();
    render(<ReportsControlBar {...base} onDurationChange={onDurationChange} />);
    screen.getByRole("tab", { name: "Swing" }).click();
    expect(onDurationChange).toHaveBeenCalledWith("swing");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test ReportsControlBar`
Expected: FAIL — module `./ReportsControlBar` cannot be resolved.

- [ ] **Step 3: Implement the component**

Create `web/src/components/ReportsControlBar.tsx`:

```tsx
import { SegmentedControl } from "./SegmentedControl";

export type ReportsSide = "all" | "long" | "short";
export type ReportsDuration = "all" | "scalp" | "day" | "swing";

export interface ReportsControlBarProps {
  side: ReportsSide;
  duration: ReportsDuration;
  onSideChange: (s: ReportsSide) => void;
  onDurationChange: (d: ReportsDuration) => void;
}

const SIDE_OPTS = [
  { value: "all", label: "All" },
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
];

const DURATION_OPTS = [
  { value: "all", label: "All" },
  { value: "scalp", label: "Scalp" },
  { value: "day", label: "Day" },
  { value: "swing", label: "Swing" },
];

export function ReportsControlBar({
  side,
  duration,
  onSideChange,
  onDurationChange,
}: ReportsControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        ariaLabel="Side"
        size="xs"
        options={SIDE_OPTS}
        value={side}
        onChange={(v) => onSideChange(v as ReportsSide)}
      />
      <SegmentedControl
        ariaLabel="Duration"
        size="xs"
        options={DURATION_OPTS}
        value={duration}
        onChange={(v) => onDurationChange(v as ReportsDuration)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `bun run test ReportsControlBar`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportsControlBar.tsx web/src/components/ReportsControlBar.test.tsx
git commit -m "feat(web): add ReportsControlBar (side/duration) (SP5 stage 1)"
```

---

### Task 3: Wire Side/Duration through the route and view

**Files:**
- Modify: `web/src/lib/api/types.ts`, `web/src/routes/reports.tsx`, `web/src/app/screens/ReportsView.tsx`
- Test: `web/src/routes/reports.search.test.ts` (extend), `web/src/app/screens/ReportsView.test.tsx` (extend)

**Interfaces:**
- Consumes: `ReportsControlBar` (Task 2), the `side`/`duration` API params (Task 1).
- Produces: `ReportsViewProps` gains `side: ReportsSide`, `duration: ReportsDuration`, `onSideChange`, `onDurationChange`; `validateReportsSearch` returns `{ tab, side, dur }`.

- [ ] **Step 1: Write the failing route test**

In `web/src/routes/reports.search.test.ts`, add cases:

```ts
  it("defaults side and dur to all", () => {
    expect(validateReportsSearch({})).toEqual({ tab: "overview", side: "all", dur: "all" });
  });

  it("passes through valid side and dur and coerces unknowns", () => {
    expect(validateReportsSearch({ side: "long", dur: "swing" })).toEqual({
      tab: "overview",
      side: "long",
      dur: "swing",
    });
    expect(validateReportsSearch({ side: "bogus", dur: "nope" })).toEqual({
      tab: "overview",
      side: "all",
      dur: "all",
    });
  });
```

(Also update the existing `validateReportsSearch` assertions in this file that use `toEqual({ tab: … })` to include `side: "all", dur: "all"`.)

- [ ] **Step 2: Write the failing view test**

In `web/src/app/screens/ReportsView.test.tsx`, add `side: "all" as const`, `duration: "all" as const`, `onSideChange: vi.fn()`, `onDurationChange: vi.fn()` to the `base` object, and add a test:

```tsx
  it("renders the control bar side/duration options", () => {
    render(<ReportsView {...base} dim="symbol" breakdown={[]} />);
    expect(screen.getByRole("tab", { name: "Long" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Swing" })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run both to verify they fail**

Run: `bun run test reports.search ReportsView`
Expected: FAIL — `validateReportsSearch` lacks `side`/`dur`; `ReportsView` lacks the control bar and the new props.

- [ ] **Step 4: Extend the frontend `Filters` type**

In `web/src/lib/api/types.ts`, add to the `Filters` interface (after `status?`):

```ts
  side?: string;
  duration?: string;
```

- [ ] **Step 5: Extend `validateReportsSearch` and wire the route**

In `web/src/routes/reports.tsx`:

Update the import to pull the control-bar types and `useMemo`:

```tsx
import { useMemo, useState } from "react";
import type { ReportsDuration, ReportsSide } from "../components/ReportsControlBar";
```

Replace `validateReportsSearch` with:

```tsx
const SIDE_VALUES: ReportsSide[] = ["all", "long", "short"];
const DUR_VALUES: ReportsDuration[] = ["all", "scalp", "day", "swing"];

export function validateReportsSearch(search: Record<string, unknown>): {
  tab: ReportsTab;
  side: ReportsSide;
  dur: ReportsDuration;
} {
  const tab = search.tab;
  const side = search.side;
  const dur = search.dur;
  return {
    tab: REPORT_TAB_VALUES.includes(tab as ReportsTab) ? (tab as ReportsTab) : "overview",
    side: SIDE_VALUES.includes(side as ReportsSide) ? (side as ReportsSide) : "all",
    dur: DUR_VALUES.includes(dur as ReportsDuration) ? (dur as ReportsDuration) : "all",
  };
}
```

Inside `ReportsPage`, read the new params and build the memoized analytics filter object + handlers (after the existing `onTabChange`):

```tsx
  const { tab, side, dur } = Route.useSearch();
  const onSideChange = (next: ReportsSide) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, side: next }) });
  const onDurationChange = (next: ReportsDuration) =>
    void navigate({ to: "/reports", search: (prev) => ({ ...prev, dur: next }) });

  const analyticsFilters = useMemo(
    () => ({
      ...filters,
      side: side === "all" ? undefined : side,
      duration: dur === "all" ? undefined : dur,
    }),
    [filters, side, dur],
  );
```

Replace every `filters` argument passed to the analytics query hooks (`useSummary`, `useRSummary`, `useEquityCurve`, `useTrades`, and all `useBreakdown(...)` calls) with `analyticsFilters`. (Note: `useTrades(filters)` also switches to `analyticsFilters` so the trades-based cards honor the filters.)

Pass the new props into `<ReportsView>` (after `onTabChange={onTabChange}`):

```tsx
      side={side}
      duration={dur}
      onSideChange={onSideChange}
      onDurationChange={onDurationChange}
```

- [ ] **Step 6: Render the control bar in `ReportsView`**

In `web/src/app/screens/ReportsView.tsx`:

Add the import:

```tsx
import {
  ReportsControlBar,
  type ReportsDuration,
  type ReportsSide,
} from "../../components/ReportsControlBar";
```

Add to `ReportsViewProps` (after `onTabChange`):

```tsx
  side: ReportsSide;
  duration: ReportsDuration;
  onSideChange: (s: ReportsSide) => void;
  onDurationChange: (d: ReportsDuration) => void;
```

Add `side,`, `duration,`, `onSideChange,`, `onDurationChange,` to the destructured parameter list (after `onTabChange,`).

Render the control bar inside `<Tabs>`, immediately after the closing `</TabsList>` and before the first `<TabsContent>`:

```tsx
        <ReportsControlBar
          side={side}
          duration={duration}
          onSideChange={onSideChange}
          onDurationChange={onDurationChange}
        />
```

- [ ] **Step 7: Run tests + lint**

Run: `bun run lint && bun run test reports.search ReportsView ReportsControlBar`
Expected: no type errors on changed files; all three suites green.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/api/types.ts web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/routes/reports.search.test.ts web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): wire side/duration filters into Reports (SP5 stage 1)"
```

---

### Task 4: Runtime verification (Stage 1)

**Files:** none.

- [ ] **Step 1: Launch + open Reports**

Use the `run`/`web:verify` skill (Vite at :5173, Playwright MCP). Open `/reports`.

- [ ] **Step 2: Verify filters**

Confirm the control bar shows below the tab bar with Side (All/Long/Short) and Duration (All/Scalp/Day/Swing). Pick Side=Long and confirm the page's numbers change and `?side=long` appears in the URL; pick Duration=Scalp and confirm `?dur=scalp` and further narrowing. Confirm deep-linking `/reports?side=short&dur=swing` applies on load. Reset to All/All.

- [ ] **Step 3: Final check**

Run: `cd api && go test ./...` and `bun run lint && bun run test`.
Expected: green (note any pre-existing unrelated failures).

---

## Notes

- Task 1 (backend) and Task 2 (control-bar component) are independent; Task 3 depends on both; Task 4 depends on all.
- `analyticsFilters` MUST be memoized (`useMemo` on `[filters, side, dur]`) — an inline object would change identity every render and thrash the React Query keys.
- Stage 2 (Net/Gross + $/% display modes) is a separate plan; it will add the two mode toggles to this same `ReportsControlBar`.
