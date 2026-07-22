# Reports Execution-Grade Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `trade_quality` breakdown dimension to the API and a dedicated, grade-ordered "Execution Grade" card to the Reports page so a trader can see whether their 1–5 execution ratings correlate with profitability.

**Architecture:** The Go breakdown handler gains a `trade_quality` dimension that emits numeric keys (`"5"…"1"` / `"unrated"`), mirroring the existing `setup` dimension. The React route adds a `useBreakdown("trade_quality", …)` query and passes it to `ReportsView`, which renders a new presentational `ReportsExecutionGrade` component. The component owns the grade scheme — it maps numeric keys to letters via the existing `tradeGrades.ts` and re-orders rows into fixed grade order (A+→C→Unrated), discarding the backend's P&L sort.

**Tech Stack:** Go (echo, testify), React + TypeScript, vite-plus/test (vitest-compatible), Testing Library.

## Global Constraints

- Package manager is **bun**: `bun run test` (frontend unit tests), `bun run lint` (typecheck + lint). NOT npm.
- Go tests: `go test ./...` run from the `api/` directory.
- Reuse existing tokens only: `--color-profit`, `--color-loss`, and `pnlColor`/`fmtSignedMoney`. No new tokens or deps.
- The grade scheme lives once, in `web/src/lib/tradeGrades.ts` (`gradeFromInt`, `TRADE_GRADES`). Do not duplicate it in Go.
- Backend emits numeric keys `"5".."1"` plus `"unrated"`; the frontend maps to letters A+…C.

---

### Task 1: Backend `trade_quality` breakdown dimension

**Files:**
- Modify: `api/internal/api/breakdown_handler.go`
- Test: `api/internal/api/breakdown_handler_test.go`

**Interfaces:**
- Consumes: existing `s.deps.Store.GetTradeJournal`, `analytics.ClosedTrade`, `analytics.Breakdown`.
- Produces: `GET /api/v1/analytics/breakdown?by=trade_quality` returning `[]BreakGroup` keyed `"5".."1"` / `"unrated"`.

- [ ] **Step 1: Write the failing test**

Add to `api/internal/api/breakdown_handler_test.go`:

```go
func TestBreakdownByTradeQuality(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "tq@x.com")
	acc := accountID(t, s, tok)

	mk := func(sym, side string, qty, price float64, ts string) {
		body := fmt.Sprintf(`{"account_id":%q,"symbol":%q,"instrument_type":"stock","side":%q,"quantity":%g,"price":%g,"executed_at":%q}`,
			acc, sym, side, qty, price, ts)
		require.Equal(t, http.StatusCreated, do(s, http.MethodPost, "/api/v1/executions", body, tok).Code)
	}
	// Two closed trades on different symbols so they get distinct trade IDs.
	mk("AAPL", "buy", 100, 10, "2026-01-01T10:00:00Z")
	mk("AAPL", "sell", 100, 12, "2026-01-01T11:00:00Z") // +200
	mk("MSFT", "buy", 50, 20, "2026-01-02T10:00:00Z")
	mk("MSFT", "sell", 50, 18, "2026-01-02T11:00:00Z") // -100

	// Fetch trade IDs, rate the AAPL trade 5 (A+); leave MSFT unrated.
	rec := do(s, http.MethodGet, "/api/v1/trades?account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var trades []struct {
		ID     string `json:"id"`
		Symbol string `json:"symbol"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &trades))
	require.Len(t, trades, 2)
	for _, tr := range trades {
		if tr.Symbol == "AAPL" {
			require.Equal(t, http.StatusOK,
				do(s, http.MethodPatch, "/api/v1/trades/"+tr.ID, `{"trade_quality":5}`, tok).Code)
		}
	}

	rec = do(s, http.MethodGet, "/api/v1/analytics/breakdown?by=trade_quality&account_id="+acc, "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var out []struct {
		Key     string `json:"key"`
		Summary struct {
			NetPnl float64 `json:"net_pnl"`
		} `json:"summary"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	require.Len(t, out, 2)

	got := map[string]float64{}
	for _, g := range out {
		got[g.Key] = g.Summary.NetPnl
	}
	require.Equal(t, 200.0, got["5"], "A+-rated AAPL trade")
	require.Equal(t, -100.0, got["unrated"], "unrated MSFT trade")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && go test ./internal/api/ -run TestBreakdownByTradeQuality -v`
Expected: FAIL — `by=trade_quality` is rejected as a bad dimension (400), so the length/assertions fail.

- [ ] **Step 3: Add the dimension to the allow-list and error message**

In `api/internal/api/breakdown_handler.go`, extend `breakdownDims`:

```go
var breakdownDims = map[string]bool{
	"symbol": true, "setup": true, "day_of_week": true, "hour_of_day": true,
	"session": true, "tag": true, "mistake": true, "trade_quality": true,
}
```

And update the `by`-validation error string to include it:

```go
		return Fail(http.StatusBadRequest, "bad_request", "by must be one of symbol|setup|day_of_week|hour_of_day|session|tag|mistake|trade_quality", nil)
```

- [ ] **Step 4: Add the switch case and helper**

In the `switch by` block (next to `case "setup":`), add:

```go
		case "trade_quality":
			add(s.qualityKey(ctx, uid, t.ID), ct)
```

Add `"strconv"` to the import block, and add this helper directly below `setupKey`:

```go
func (s *Server) qualityKey(ctx context.Context, userID, tradeID string) string {
	j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: userID})
	if err != nil || !j.TradeQuality.Valid {
		return "unrated"
	}
	return strconv.FormatInt(j.TradeQuality.Int64, 10)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api && go test ./internal/api/ -run TestBreakdownByTradeQuality -v`
Expected: PASS.

- [ ] **Step 6: Run the full API package to check nothing regressed**

Run: `cd api && go test ./...`
Expected: PASS (all packages).

- [ ] **Step 7: Commit**

```bash
git add api/internal/api/breakdown_handler.go api/internal/api/breakdown_handler_test.go
git commit -m "feat(api): add trade_quality breakdown dimension (SP2)"
```

---

### Task 2: `ReportsExecutionGrade` component

**Files:**
- Create: `web/src/components/ReportsExecutionGrade.tsx`
- Test: `web/src/components/ReportsExecutionGrade.test.tsx`

**Interfaces:**
- Consumes: `BreakGroup` from `../lib/api/types`; `gradeFromInt`, `TRADE_GRADES` from `../lib/tradeGrades`; `pnlColor` from `./theme-tokens`; `fmtSignedMoney` from `../lib/format`; `intlLocale` from `../lib/locale`; `usePrivacyMode` from `../lib/displayPrefs`; `Card`, `Skeleton`, `EmptyState`.
- Produces: `export function ReportsExecutionGrade(props: ReportsExecutionGradeProps)` and `export interface ReportsExecutionGradeProps { breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number }`. Each rendered row exposes `data-testid="exec-grade-row"`, the grade label `data-testid="exec-grade-label"`, and the bar `data-testid="exec-grade-bar"`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/ReportsExecutionGrade.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { BreakGroup } from "../lib/api/types";
import { ReportsExecutionGrade } from "./ReportsExecutionGrade";

function grp(key: string, net: number, pf = 1): BreakGroup {
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
      profit_factor: pf,
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

const props = { loading: false, error: false, currency: "USD" };

describe("ReportsExecutionGrade", () => {
  it("orders rows A+ first and Unrated last regardless of input P&L order", () => {
    render(
      <ReportsExecutionGrade
        {...props}
        breakdown={[grp("unrated", 500), grp("1", -100), grp("5", 50)]}
      />,
    );
    const labels = screen.getAllByTestId("exec-grade-label").map((el) => el.textContent);
    expect(labels).toEqual(["A+", "C", "Unrated"]);
  });

  it("maps numeric keys to letter grades", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("3", 10)]} />);
    expect(screen.getByTestId("exec-grade-label").textContent).toBe("A-");
  });

  it("colors net P&L by sign", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("5", 200), grp("1", -100)]} />);
    expect(screen.getByText("+$200.00")).toHaveClass("text-profit");
    expect(screen.getByText("-$100.00")).toHaveClass("text-loss");
  });

  it("sizes each bar proportionally to |net P&L|", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[grp("5", 200), grp("1", -100)]} />);
    const bars = screen.getAllByTestId("exec-grade-bar");
    expect(bars[0].style.width).toBe("100%"); // 200 is the max
    expect(bars[1].style.width).toBe("50%"); // 100 / 200
  });

  it("renders an empty state when there is no data", () => {
    render(<ReportsExecutionGrade {...props} breakdown={[]} />);
    expect(screen.getByText(/no/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test ReportsExecutionGrade`
Expected: FAIL — module `./ReportsExecutionGrade` cannot be resolved.

- [ ] **Step 3: Implement the component**

Create `web/src/components/ReportsExecutionGrade.tsx`:

```tsx
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { pnlColor } from "./theme-tokens";
import type { BreakGroup } from "../lib/api/types";
import { usePrivacyMode } from "../lib/displayPrefs";
import { fmtSignedMoney } from "../lib/format";
import { intlLocale } from "../lib/locale";
import { TRADE_GRADES, gradeFromInt } from "../lib/tradeGrades";

export interface ReportsExecutionGradeProps {
  breakdown: BreakGroup[];
  loading: boolean;
  error: boolean;
  currency: string;
  fxRate?: number;
}

// A+ (best) → C (worst); Unrated always last.
const GRADE_RANK: Record<string, number> = Object.fromEntries(
  TRADE_GRADES.map((g, i) => [g, i]),
);

function labelFor(key: string): { label: string; rank: number } {
  if (key === "unrated") return { label: "Unrated", rank: 999 };
  const grade = gradeFromInt(Number(key));
  if (!grade) return { label: key, rank: 998 };
  return { label: grade, rank: GRADE_RANK[grade] };
}

function pfText(pf: number): string {
  return Number.isFinite(pf) && pf > 0 ? pf.toFixed(2) : "—";
}

export function ReportsExecutionGrade({
  breakdown,
  loading,
  error,
  currency,
  fxRate = 1,
}: ReportsExecutionGradeProps) {
  usePrivacyMode();
  const locale = intlLocale();

  const rows = breakdown
    .map((g) => ({ g, ...labelFor(g.key) }))
    .sort((a, b) => a.rank - b.rank);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.g.summary.net_pnl)));

  return (
    <Card title="Execution Grade">
      {loading ? (
        <Skeleton height="220px" />
      ) : error ? (
        <p className="text-xs text-loss">Failed to load execution grade.</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No rated trades" hint="Rate your execution on trades to see this." />
      ) : (
        <ul className="flex flex-col gap-3 px-4 pb-3">
          {rows.map(({ g, label }) => {
            const net = g.summary.net_pnl * fxRate;
            const pct = (Math.abs(g.summary.net_pnl) / maxAbs) * 100;
            const barColor = g.summary.net_pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)";
            return (
              <li key={g.key} data-testid="exec-grade-row" className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span data-testid="exec-grade-label" className="text-sm font-semibold text-fg">
                    {label}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-[10px] tracking-wide text-flat">
                      PF {pfText(g.summary.profit_factor)}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${pnlColor(g.summary.net_pnl)}`}>
                      {fmtSignedMoney(net, currency, locale)}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-inset">
                  <div
                    data-testid="exec-grade-bar"
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <span className="text-[10px] text-flat">
                  {g.summary.wins}W · {g.summary.losses}L
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test ReportsExecutionGrade`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/ReportsExecutionGrade.tsx web/src/components/ReportsExecutionGrade.test.tsx
git commit -m "feat(web): add ReportsExecutionGrade card (SP2)"
```

---

### Task 3: Wire the card into Reports

**Files:**
- Modify: `web/src/routes/reports.tsx`
- Modify: `web/src/app/screens/ReportsView.tsx`
- Test: `web/src/app/screens/ReportsView.test.tsx`

**Interfaces:**
- Consumes: `ReportsExecutionGrade` (Task 2); `useBreakdown` (existing); the `by=trade_quality` endpoint (Task 1).
- Produces: three new `ReportsViewProps` fields — `qualityBreakdown: BreakGroup[]`, `qualityBreakdownLoading: boolean`, `qualityBreakdownError: boolean`.

- [ ] **Step 1: Write the failing test**

Add to `web/src/app/screens/ReportsView.test.tsx`. First add the three fields to the `base` object (immediately after the `sessionBreakdown*` lines):

```tsx
  qualityBreakdown: [],
  qualityBreakdownLoading: false,
  qualityBreakdownError: false,
```

Then add a test inside the `describe("ReportsView", …)` block:

```tsx
  it("renders the execution grade card", () => {
    render(
      <ReportsView
        {...base}
        dim="symbol"
        breakdown={[]}
        qualityBreakdown={[grp("5", 200), grp("1", -100)]}
      />,
    );
    expect(screen.getByText("Execution Grade")).toBeInTheDocument();
    expect(screen.getByText("A+")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test ReportsView`
Expected: FAIL — TypeScript rejects the unknown `qualityBreakdown` prop and/or "Execution Grade" is not found.

- [ ] **Step 3: Extend the dimension types**

In `web/src/app/screens/ReportsView.tsx`, add `"trade_quality"` to the `BreakdownDim` union and to `DIM_LABELS`:

```tsx
export type BreakdownDim =
  | "symbol"
  | "setup"
  | "day_of_week"
  | "hour_of_day"
  | "session"
  | "tag"
  | "mistake"
  | "trade_quality";

const DIM_LABELS: Record<BreakdownDim, string> = {
  symbol: "Symbol",
  setup: "Setup",
  day_of_week: "Day of Week",
  hour_of_day: "Hour",
  session: "Session",
  tag: "Tag",
  mistake: "Mistake",
  trade_quality: "Execution",
};
```

Leave `SELECTOR_DIMS` unchanged (the grade breakdown gets its own card, not the selector).

- [ ] **Step 4: Add the props and import**

Add the import near the other component imports:

```tsx
import { ReportsExecutionGrade } from "../../components/ReportsExecutionGrade";
```

Add to the `ReportsViewProps` interface (after the `sessionBreakdown*` fields):

```tsx
  qualityBreakdown: BreakGroup[];
  qualityBreakdownLoading: boolean;
  qualityBreakdownError: boolean;
```

Add the same three names to the destructured parameter list of the `ReportsView` function (after `sessionBreakdownError,`):

```tsx
  qualityBreakdown,
  qualityBreakdownLoading,
  qualityBreakdownError,
```

- [ ] **Step 5: Render the card**

In the JSX, immediately after the closing `/>` of the `<ReportsRMultiplePerformance … />` block and before the `<div className="grid gap-4 lg:grid-cols-2">` that holds Symbol/Tag, insert:

```tsx
      <ReportsExecutionGrade
        breakdown={qualityBreakdown}
        loading={qualityBreakdownLoading}
        error={qualityBreakdownError}
        currency={displayCurrency}
        fxRate={fxRate}
      />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun run test ReportsView`
Expected: PASS.

- [ ] **Step 7: Wire the data query in the route**

In `web/src/routes/reports.tsx`, add the query after `sessionBreakdownQ`:

```tsx
  const qualityBreakdownQ = useBreakdown("trade_quality", filters);
```

And pass the three props into `<ReportsView>` (after the `sessionBreakdown*` props):

```tsx
      qualityBreakdown={qualityBreakdownQ.data ?? []}
      qualityBreakdownLoading={qualityBreakdownQ.isLoading}
      qualityBreakdownError={qualityBreakdownQ.isError}
```

- [ ] **Step 8: Run lint/typecheck and the full frontend suite**

Run: `bun run lint && bun run test`
Expected: PASS (no type errors; all tests green).

- [ ] **Step 9: Commit**

```bash
git add web/src/routes/reports.tsx web/src/app/screens/ReportsView.tsx web/src/app/screens/ReportsView.test.tsx
git commit -m "feat(web): wire execution grade card into Reports (SP2)"
```

---

### Task 4: Runtime verification

**Files:** none (manual/skill-driven verification).

- [ ] **Step 1: Launch the app and open Reports**

Use the `run` (or `web:verify`) skill to start the app, log in, and navigate to the Reports page against a DB with seeded trades that carry execution ratings. (If no rated trades exist, PATCH a few via the trade detail view's "Execution rating" field first.)

- [ ] **Step 2: Confirm the card**

Verify the **Execution Grade** card lists grades in fixed order A+ → A → A- → B → C → Unrated (only grades with trades appear), each showing net P&L (green/rose), a profit factor, and a proportional bar. Check both light and dark themes and mobile + desktop widths.

- [ ] **Step 3: Final full check**

Run: `cd api && go test ./...` and `bun run lint && bun run test`
Expected: all green.

---

## Notes

- Task 1 (backend) and Task 2 (component) are independent and could be built in either order; Task 3 depends on both. Task 4 depends on all.
- The backend adds one `GetTradeJournal` call per closed trade for this dimension only, matching the existing `setup` dimension's cost. No new N+1 beyond the established pattern.
