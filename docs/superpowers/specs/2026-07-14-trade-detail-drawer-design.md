# Trade Detail Drawer — Bento Hero Redesign

**Date:** 2026-07-14
**Status:** Approved
**Scope:** `web/src/components/TradeDetailSheet.tsx` (+ small additions; no API changes)

## Goal

Upgrade the trade detail drawer from a sparse summary into a "rich glance" panel in the
Signal Terminal bento style. The drawer stays read-only; editing, attachments, and full
journal fields remain on the full page (`/trades/$id`).

## Content decisions

Data already returned by `GET /trades/:id` (`TradeDetail`) but currently unused in the
drawer, now shown:

- `opened_at` / `closed_at` — dates were missing entirely.
- `fees_total` + `gross_pnl` — gross → fees → net micro-breakdown.
- `r_multiple` — next to return %.
- `tags` + `setup.name` — context row.
- `notes` — 3-line clamped preview.

Explicitly **not** shown in the drawer (full page only): attachments, MAE/MFE,
emotional state, confidence, trade quality, dividend totals, editing of any kind.

## Layout (top to bottom)

### 1. Header row

Existing `DrawerHeader` kept. Title becomes `CL5173 · STK · SHORT`: symbol in
`text-text`, then ` · ` separated market label and direction in `text-text-muted`
(smaller weight). "Open full page" and close button unchanged. The STK/SHORT pills are
removed from the body pill row since they now live in the title.

### 2. Status line

Under the header, one line: status `Pill` (WIN/LOSS/BE/OPEN, existing `tradeStatus`
tones) followed by muted text:

- Closed: `Jul 12, 04:00 PM → 04:00 PM · <1m` (same-day close may repeat the date; fine).
- Open: `Jul 12, 04:00 PM · still open`.

Dates via `toLocaleString(intlLocale(), …)` consistent with the executions list.

### 3. Bento hero block

CSS grid, 1px gaps showing `bg-bg` hairlines, cells `bg-bg-panel` with
`rounded-sharp` (per DESIGN.md: data sharp, controls soft; bento = 1px gap hairlines).

- **Left cell** (spans full height, ~55% width): hero P&L using `heroPnlClass` glow
  (profit/loss text-shadow), beneath it `+4.55% · +0.50R` (R only when
  `r_multiple != null`), and at the bottom a micro line
  `$2.50 gross − $0.00 fees` in `text-micro text-text-dim` (only when
  `gross_pnl != null`). If `net_pnl == null` (open, no unrealized), the cell shows `—`
  without glow.
- **Right column, row 1**: ENTRY, EXIT cells.
- **Right column, row 2**: QTY, HOLD, FEES cells.
- Cell content = existing `MetaStat` pattern (10px uppercase muted label, 14px
  tabular value). EXIT shows `—` while open; QTY shows remaining for open trades
  (existing logic).

### 4. Context row

Tags as small muted pills + `⚡ Setup: <name>` (Lucide `Zap` 14px, `text-signal` per
wayfinding rules) — whole row omitted when `tags.length === 0 && setup == null`.

### 5. Risk / Reward

Keep the shared `RiskRewardPanel` with `hideWhenEmpty` — no fork, no restyle.

### 6. Chart

`TradeChartSection` keeps its behavior; its empty state (the "No market data for this
window." copy at `TradeChartSection.tsx:62`) becomes an inset well: `bg-bg-inset`,
`rounded-sharp`, centered muted copy with a small Lucide `CandlestickChart` icon.
This component is shared with the full page — the improvement applies to both,
which is desirable.

### 7. Executions

Each fill row:

- Side chip: `B` / `S`, 16px square, `rounded-control`, tinted `bg` from
  profit/loss at ~12% opacity with matching text color.
- `qty @ price` in tabular nums `text-text`.
- Fee amount in `text-text-dim` when `fees + commission > 0`.
- Timestamp right-aligned `text-text-muted`.
- Row hover: `bg-bg-hover` (borderless separation, per user preference).

### 8. Notes preview

When `trade.notes` trimmed non-empty: `NOTES` section (existing signal-yellow section
label), body `line-clamp-3` in `text-sm text-text-muted whitespace-pre-wrap`, followed
by a "Read more" link styled like "Open full page" that navigates to `/trades/$id`.
Omitted entirely when empty.

## Loading / error states

- Skeletons updated to approximate the new block heights (status line, bento block,
  executions).
- Error state unchanged.

## Non-goals

- No API/DTO changes.
- No changes to the full-page `TradeDetailView` other than (possibly) the shared chart
  empty state.
- No editing affordances in the drawer.

## Testing

- New `TradeDetailSheet.test.tsx`: renders closed trade (dates, gross→fees→net, R,
  tags/setup row, executions fees), open trade (OPEN status, `—` exit, "still open"),
  notes preview present/absent, context row omitted when empty.
- `vp check` + `vp test` green.
- Runtime verification via the `web:verify` skill (open drawer from trades table,
  check both a winning closed trade and an open trade).
