# Smart Import — Design

**Date:** 2026-07-10
**Status:** Approved
**Scope:** `api/` (importer package, import handlers) + `web/` (ImportView, imports API client). No schema migrations — the import batch's existing `source` column stores the detected parser name.

## Goal

Bring TraderMemos' CSV import to parity with Stonk Journal's "Smart Import":

1. **Dedicated broker parsers with auto-detection** — upload a broker export
   and it parses with no column mapping. Initial set (documented formats):
   Interactive Brokers Activity Statement, thinkorswim Account Statement,
   TradingView (paper/live), NinjaTrader Executions. The registry makes each
   additional broker a single Go file + fixture test.
2. **Live pre-commit preview** — parsed executions plus a dry run of the real
   trade-grouping engine (`trades.Group`), so the user sees the exact trades,
   P&L, duplicate count, and row errors an import would produce before
   committing. In the generic path the preview refreshes live as the mapping
   is edited.
3. **Locale-aware parsing** — EU number formats (decimal comma, thousands
   dot) and DD/MM/YYYY dates detected per file, fixing silent 100× price
   misparses. Applies to the generic parser and all broker parsers.

## 1. Backend: importer package

### Registry & interfaces

- Existing header-based `Importer` interface stays (Generic keeps using it).
- New interface for dedicated parsers, which need raw file access because
  IBKR/thinkorswim exports are multi-section documents whose trade table is
  not at row 1:

```go
type FileImporter interface {
	Name() string
	DetectFile(raw []byte) bool
	ParseFile(raw []byte) (ParseResult, error)
}
```

- `Registry` holds the dedicated parsers in a fixed order and returns the
  first whose `DetectFile` matches; no match → generic mapping flow.
- **Conservative fallback:** if a detected parser yields >50% row errors,
  detection is discarded and the upload falls back to the generic path.

### Parsers (one file + fixture test each)

| File | Format | Notes |
|---|---|---|
| `ibkr.go` | Activity Statement CSV | Section-tagged rows (`Trades,Header,…` / `Trades,Data,…`); asset category → `instrument_type`; option/futures multiplier |
| `thinkorswim.go` | Account Statement | Locate "Account Trade History" section |
| `tradingview.go` | Flat CSV export | Paper and live account exports |
| `ninjatrader.go` | Executions grid export | Instrument/Action/Quantity/Price/Time/Commission |

- `ParsedExecution` gains `Multiplier float64` (default 1). Commit currently
  hardcodes `Multiplier: 1` — a latent bug for options/futures that this
  fixes.

### Locale sniffing (`numfmt.go`)

- Per-file decision made once from evidence across sampled cells:
  - Decimal style: patterns like `1.234,56` → comma-decimal; `1,234.56` →
    point-decimal.
  - Date order: any first component >12 → DD/MM; otherwise ambiguous
    defaults to MM/DD, except comma-decimal files default to DD/MM.
- Shared `ParseNumber(s, locale)` / `ParseTime(s, locale)` helpers replace
  `strconv.ParseFloat` and the bare layout list in the generic parser, and
  are used by all broker parsers.

## 2. API

### `POST /imports` (upload — shape extended)

- Runs registry detection on the raw file before the generic path.
- Response adds `detected_importer` (parser name, or `""`).
- When detected, the response also carries the full review payload (same
  fields as `/preview` below), and the batch's `source` column stores the
  parser name (today it is always `"csv"`). Generic files return
  `headers` / `sample_rows` / `suggested_mapping` unchanged.

### `POST /imports/:id/preview` (new — live review)

Stateless like commit: the client re-sends the file, plus optional
`column_mapping` and `instrument_type` for the generic path. Returns:

```json
{
  "executions_preview": [ { "symbol", "side", "quantity", "price",
      "fees", "commission", "executed_at", "multiplier" } ],   // first 20
  "total_executions": 142,
  "errors": [ { "row", "message" } ],
  "dry_run_trades": [ { "symbol", "direction", "qty", "avg_entry",
      "avg_exit", "net_pnl", "status" } ],                     // trades.Group()
  "dedup": { "new": 105, "duplicates": 37 }
}
```

- `dry_run_trades` comes from the existing pure `trades.Group(fills)`.
- `dedup` uses the same hash + `ExecutionExists` check commit uses.
- Web calls it once immediately after a detected upload, and debounced on
  every mapping change in the generic path.

### `POST /imports/:id/commit` (extended)

- If the batch `source` names a dedicated parser → parse with it;
  `column_mapping` becomes optional. Otherwise generic as today.
- `Multiplier` from `ParsedExecution` flows to `InsertExecution`.
- Dedup, batch status, and regroup unchanged.

## 3. Frontend (ImportView)

- **Detected path:** accent-tinted banner ("✓ Detected: Interactive Brokers —
  no column mapping needed") → Review step: parsed-executions table,
  dry-run trades table (Pill/pnlColor styling), summary line
  ("142 executions → 37 trades · 37 duplicates skipped · 2 rows with
  errors"), expandable row-error list → Commit / Cancel.
- **Generic path:** existing mapping UI with the same Review panel rendered
  live below it, refreshed via debounced `/preview` calls as the mapping
  changes.
- Row errors never block commit (bad rows are skipped and reported). A file
  where zero rows parse disables Commit and shows the errors.

## 4. Testing

- Fixture exports per broker in `api/internal/importer/testdata/`, built
  from documented formats; real user-provided exports tighten them later.
- Table-driven Go tests per parser; `numfmt` tests covering the EU/US
  ambiguity matrix (decimal comma, thousands separators, DD/MM vs MM/DD,
  ambiguous dates in both locales).
- Handler tests: detected upload, preview (including dedup counts and the
  generic+mapping path), commit-with-parser, conservative fallback.
- Web: vitest for the detected path and live preview rendering; Playwright
  import step only if fixture upload against the live API proves practical.

## Explicitly out of scope

- The other 10 Stonk brokers (Tradovate, eToro, TopstepX, Rithmic,
  Hola Prime/MT5, Bitunix, TradeZero, Wealthsimple, Questrade xlsx, AMP) —
  each becomes a one-file addition once sample exports are available.
- Excel (.xlsx) parsing, sub-account pickers, LLM-assisted mapping.
