# Reports Execution-Grade Breakdown

**Date:** 2026-07-21
**Status:** Approved (design)
**Scope:** Sub-project 2 of the staged Reports upgrade inspired by the Tradervue Dashboard/Reports screenshots.

## Context

The Reports page (`web/src/app/screens/ReportsView.tsx`) already exceeds the reference
screenshots on analytics depth. The upgrade was decomposed into staged sub-projects, each with
its own spec → plan → build cycle:

1. Visual widgets (gauge, donut, split bar) — **DONE** on branch `reports-insight-widgets`.
2. **Execution-grade breakdown** (this spec) — performance grouped by the 1–5 `trade_quality`
   rating: "do my A-grade executions actually make money?"
3. Open-trades table — **SKIPPED** (per user).
4. Tab organization (Overview / Detailed / Win-Loss / Risk).
5. Filter + control bar (Gross/Net toggle, Side/Duration, $/% view).

This spec covers **Sub-project 2 only**.

## Problem

Every closed trade can carry an **execution rating** — the journal's 1–5 `trade_quality` field,
surfaced in the UI as the "Execution rating" and rendered as a letter grade (A+=5, A=4, A-=3,
B=2, C=1) via `web/src/lib/tradeGrades.ts`. Nothing on the Reports page aggregates performance by
this rating, so a trader cannot see whether their self-assessed execution quality actually
correlates with profitability. The value is a correlation read across an ordered grade ladder,
not a "rank the winners" view.

## Goals

- Expose a new `trade_quality` breakdown dimension from the breakdown API, mirroring the existing
  `setup` dimension.
- Add a dedicated, always-visible **Execution Grade** card to the Reports page that lists grades in
  fixed order A+ → A → A- → B → C → Unrated, each with net P&L, profit factor, and a proportional
  bar, so the edge-vs-grade correlation reads top to bottom.

## Non-Goals

- No change to the existing Setup/Mistake dimension selector — the grade breakdown gets its own card.
- No tabs (Sub-project 4) or filter/control bar (Sub-project 5).
- No new persisted fields. `trade_quality` already exists on `trade_journal` as `sql.NullInt64`.

## Design

### Backend (`api/internal/api/breakdown_handler.go`)

- Add `"trade_quality": true` to the `breakdownDims` allow-list (and to the `by` error message).
- Add a `switch` case:

  ```go
  case "trade_quality":
      add(s.qualityKey(ctx, uid, t.ID), ct)
  ```

- New helper `qualityKey`, mirroring `setupKey` (one `GetTradeJournal` call per trade):

  ```go
  func (s *Server) qualityKey(ctx context.Context, userID, tradeID string) string {
      j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: userID})
      if err != nil || !j.TradeQuality.Valid {
          return "unrated"
      }
      return strconv.FormatInt(j.TradeQuality.Int64, 10) // "5".."1"
  }
  ```

- Grouping and summarizing reuse the existing `analytics.Breakdown` (which sorts by net P&L
  descending). The server does **not** know about letter grades — it emits numeric keys `"5"…"1"`
  plus `"unrated"`. The frontend owns the grade scheme and the grade-order re-sort.

### Frontend data source (`web/src/routes/reports.tsx`)

- Add `const qualityBreakdownQ = useBreakdown("trade_quality", filters);`.
- Pass `qualityBreakdown` / `qualityBreakdownLoading` / `qualityBreakdownError` into `ReportsView`.

### Frontend types (`web/src/app/screens/ReportsView.tsx`)

- Add `"trade_quality"` to the `BreakdownDim` union and `DIM_LABELS` (label: `"Execution"`).
- Do **not** add it to `SELECTOR_DIMS` — it renders as its own card.
- Add the three `qualityBreakdown*` props to `ReportsViewProps` and render `<ReportsExecutionGrade>`
  among the always-visible breakdown cards (near Setup/Symbol).

### New component (`web/src/components/ReportsExecutionGrade.tsx`)

Presentational; keeps the single source of grade truth on the client.

- Props: `{ breakdown: BreakGroup[]; loading: boolean; error: boolean; currency: string; fxRate?: number }`.
- **Ordering:** map each `g.key` to a rank — numeric keys via `gradeFromInt(Number(key))` then a
  fixed A+ → C index; `"unrated"` sorts last. Render only grades present in `breakdown` (no
  synthetic zero rows). The backend's P&L sort is discarded in favor of grade order.
- **Row layout:** grade label (e.g. "A+"), net P&L (`fmtSignedMoney`, colored via `pnlColor`),
  profit factor (`g.summary.profit_factor`), and a proportional bar whose width is
  `|net_pnl| / maxAbsNetPnl` across the visible rows, colored by sign (`--color-profit` /
  `--color-loss`). A small trade-count subtitle per row (`g.summary` win/loss counts).
- **States:** wrapped in the standard `Card`; `Skeleton` while `loading`; `"Failed to load…"` on
  `error`; `EmptyState` when `breakdown` is empty (no rated trades).
- Uses `usePrivacyMode()` and `intlLocale()` like the sibling cards; honors `fxRate`.

### Colors / tokens

Reuse existing tokens only: `--color-profit`, `--color-loss`, and `pnlColor` from
`web/src/components/theme-tokens`. No new tokens.

## Testing (TDD — write tests first)

- **Go** (`api/internal/api/breakdown_handler` / `analytics` test): `by=trade_quality` groups closed
  trades by their rating (`"5"…"1"`) and buckets a null `TradeQuality` as `"unrated"`; invalid `by`
  still rejected; the response summaries are correct per grade.
- **`ReportsExecutionGrade.test.tsx`:** rows render in fixed grade order (A+ first) with Unrated last
  regardless of the input P&L order; numeric keys map to the right letters; net P&L sign drives
  color; bar widths are proportional to `|net_pnl|`; empty input renders the empty state.
- **`ReportsView.test.tsx`** (extend): the new `qualityBreakdown*` props render the card without
  breaking existing assertions.

## Rollout / verification

- Go tests green (`go test ./...` in `api/`); frontend unit tests green (`bun run test`);
  TypeScript + lint clean (`bun run lint`).
- Runtime check via the `web:verify` / `run` skill: open Reports, confirm the Execution Grade card
  lists grades A+→C→Unrated in order with net P&L, PF, and proportional bars, in both light and dark
  themes and at mobile + desktop widths.

## Files

- New: `web/src/components/ReportsExecutionGrade.tsx` (+ `.test.tsx`).
- Modified: `api/internal/api/breakdown_handler.go` (+ Go test), `web/src/routes/reports.tsx`,
  `web/src/app/screens/ReportsView.tsx` (+ `ReportsView.test.tsx`).
- No route, schema, or persisted-type changes.
