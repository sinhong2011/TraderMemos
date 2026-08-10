# Demo trade data

`tradermemos-demo-trades.json` is a ready-to-import book of trades for a demo
account — the one handed to App Store review, and the source for screenshots.

It deliberately carries **no account information**. There is no `account`
block, no `account_id` / `account_name`, no broker, no starting balance and no
cash transactions. Importing it drops the trades into whichever account you
pick at import time, so the same file works for any reviewer account without
leaking or implying a real one.

## Importing

Web: **Import** → choose the file → review the preview → commit.

CLI:

```sh
tradermemos import --account <account-id> --file docs/demo/tradermemos-demo-trades.json
```

The file is in the app's own JSON export shape, so it round-trips through the
normal `journal_trades` import path. Executions are deduplicated per account
on `(symbol, side, qty, price, executed_at)`, so re-importing is a no-op rather
than a double-up.

## What's inside

| | |
|---|---|
| Trades | 172 — 168 closed, 4 still open |
| Fills | 370 (30 trades scale out across two exits) |
| Range | 2025-08-13 → 2026-08-04, 13 calendar months |
| Instruments | 127 stock, 45 option (OCC-style contract symbols, ×100) |
| Symbols | 22 large-cap US names and index ETFs |
| Direction | 149 long, 23 short |
| Win rate | 60.1% |
| Net P&L | +$24,990.52, profit factor 2.15 |
| Avg win / loss | $462.66 / $324.44 |
| Notes | 112 trades carry a written review |
| Setups | 8-strategy playbook with theses and checklists |
| Tags | custom plus `mistake`-kind tags on losing trades |

Every trade also has an emotional state, a 1–5 confidence rating, and target
and stop prices, so the journal, analytics, calendar and reports screens all
have something to show.

## Notes on the shape of the data

- Trade-level P&L is derived from the fills, so the numbers stay consistent
  after the importer regroups executions into trades.
- Timestamps are real New York market hours serialised as UTC, DST-correct,
  and skip weekends and US market holidays.
- Prices follow a per-symbol random walk across the period, so a symbol's
  entries drift coherently instead of jumping between trades.
- Results include two deliberate drawdown stretches — the equity curve is not
  a straight ramp.
- Notes and tags are conditioned on what each trade actually is: a scale-out
  note only appears on a trade with two exits, an overnight note only on a
  multi-day hold.

The data is synthetic. The symbols are real tickers but the prices, fills and
results are generated, and none of it reflects any real account or person.
