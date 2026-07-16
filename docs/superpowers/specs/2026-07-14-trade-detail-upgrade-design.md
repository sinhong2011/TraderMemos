# Trade Detail Page Upgrade — Design

**Date:** 2026-07-14
**Scope:** `web/src/app/screens/TradeDetailView.tsx` (+ its test file)
**Approved:** Full migration + content upgrades (user-selected option)

## Problem

TradeDetailView is the last major screen on the old bordered layout (`Panel` +
`border-b` dividers + `divide-y` sections), while Dashboard/Trades/Reports use
the borderless `Page` + `Card` pattern. Content gaps: bare 1–5 number inputs
for confidence/quality, checkbox lists for tags/mistakes, unlabeled add-fill
row, full-width screenshot stack, no hold-duration stat, no outcome badge.

## Design

### Layout (Page + Card)

```
Page fill (bg-bg void, gap-4)
├─ ← Back to trades (plain link row)
├─ Card — header
│    symbol · direction pill · instrument · WIN/LOSS/OPEN badge
│    hero P&L (glow) · return% · R-multiple · Div/Total chips
│    meta row: Opened · Closed · Held · Qty · Entry · Exit · Fees
├─ Card "Chart" (flush) — TradeChartSection
├─ Card "Risk / Reward" — RiskRewardPanel cells (hidden when empty;
│    quiet inline hint instead)
└─ grid lg:[3fr_2fr] gap-4
   ├─ left column (gap-4)
   │   ├─ Card "Fills (n)" (flush) — borderless dense table + Add fill form
   │   └─ Card "Screenshots" — upload button + 2-col thumbnail grid
   └─ Card "Journal" — journal form
```

### Content upgrades

- **Held stat** — `fmtDuration(trade.time_in_trade_secs)` in the header meta row.
- **Outcome badge** — WIN/LOSS (net_pnl sign) when closed, OPEN otherwise.
- **Rating control** — Confidence and Trade quality become 1–5 toggle button
  rows (`aria-pressed`, radiogroup semantics); form state stays string-typed
  (`"" | "1".."5"`) so `JournalFormState` and route wiring are unchanged.
- **Tag chips** — Tags/Mistakes become toggle chips (accent tint for custom,
  loss tint for mistakes) instead of checkbox lists; same `tag_ids` state.
- **Add fill** — labeled fields (Side/Qty/Price/Fee/Executed) instead of
  placeholder-only inputs.
- **Fills table** — drop per-cell `border-b`; use row hover only. Header row
  on `bg-bg-elevated` per table convention.
- **Screenshots** — thumbnail grid (`grid-cols-2`), filename + size caption,
  delete button per item; dashed empty state retained.

### Unchanged (constraints)

- `JournalFormState`, `journalDraftKey`, draft restore/debounce persistence.
- `AddFillInput` shape and `onAddFill` flow.
- `AuthedImage` blob fetching.
- All props of `TradeDetailView` (route file untouched).

## Testing

Existing tests keep passing (labels/values preserved). Add/adjust tests for:
rating control selection, tag chip toggling, Held stat rendering.
Validate with `vp check` + `vp test` from `web/`.
