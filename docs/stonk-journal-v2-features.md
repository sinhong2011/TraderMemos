# Stonk Journal v2 — Feature Inventory

Cataloged 2026-07-10 from a live tour of https://v2.stonkjournal.com (logged-in
account), plus exact design tokens read from the app's CSS. Reference for
TraderMemos visual parity and future roadmap.

## Design tokens (exact, from live CSS custom properties)

| Token | Value | TraderMemos mapping |
|---|---|---|
| `--bg-main` | `#20222d` | `--color-surface-base` / `--color-surface-panel` |
| `--bg-panel` / `--bg-input` | `#2a2d39` | `--color-surface-raised` |
| `--bg-muted` | `#1a1c24` | `--color-surface-deep` |
| `--border` | `#2d313d` | `--color-border` |
| `--text-main` | `#c8cdd9` | `--color-text` |
| `--text-muted` | `#8a92a6` | `--color-text-muted` |
| `--text-strong` | `#ffffff` | `--color-text-strong` |
| `--accent-blue` | `#4fa5ff` | `--color-accent` |
| `--accent-green` | `#52ca96` | `--color-pos` |
| `--accent-red` | `#eb4b68` | `--color-neg` |
| `--accent-yellow` | `#eab308` | `--color-amber` |
| `--ui-radius` | `.425rem` (~7px) | `--radius-control` |
| Body font | system-ui stack, 13px | Geist Variable (kept) |

Hover/active tones sampled from screenshots: hover `#353946`, active nav item
`#222838`. Pill fills: WIN `#283b3d`, LOSS `#412937`, HOLD chip `#252f42`,
active segmented chip `#2a3c57`. Calendar loss cells are magnitude-scaled
red mixes (`#492a39` → `#713245`).

## Shell

- Sidebar: logo wordmark; account selector + "Manage accounts" link; nav —
  Dashboard, Stats, Calendar, AI Coach (PRO), Import (PRO), Settings, Help;
  quick actions — New Trade, New Setup, New Note; "Migrate from V1";
  "Support this platform" (Buy Me a Coffee).
- Header: collapse-sidebar toggle; account P&L figure + Cash / Active
  sub-stats; "Search and Filter" box; theme + visibility icon buttons;
  "Open support"; user avatar menu.
- Toolbox icon rail ("TB"): Trade planner, P&L calculator, Kelly criterion,
  Currency converter, Today, Advanced chart, Economic calendar, Technical
  rating, Heatmap (TradingView-style embedded widgets).
- Login page: Google OAuth, email/password ("no verification"), remember
  device, forgot password; marketing panel (free/no ads/PWA offline).

## Dashboard

- Equity sparkline band with 30D/90D/ALL range control.
- Stats strip where WINS / OPEN / LOSSES / WASH chips are **clickable
  filters** for the table below; AVG W / AVG L with % values; PnL block with
  an expander (`〉`).
- Trades table columns: DATE, SYMBOL, STATUS, DIR (↗/↘ + LC/LP option
  subtype), MARKET (STK/OPT icons), QTY, ENTRY, EXIT, ENT TOT, EXT TOT,
  **POS** (remaining position), HOLD, RETURN, RETURN %, per-row "···" menu,
  table-options gear. Footer "All N trades loaded".

## Calendar

- Month grid with magnitude-tinted P&L day cells + per-day W/L record;
  8th WEEK summary column; today dot; ‹ › + Today nav.
- Month header stats: Trades, Win rate, Record (NW·NL), Profit factor,
  Month P&L with %.

## Stats page (analytics suite)

- Filters + Share button + AI Analysis.
- Equity Curve; Drawdown chart (Max/Current/At Peak).
- Core metrics: Total Trades, Win Rate, Profit Factor, Expectancy,
  Avg Win/Loss, Largest Win/Loss, Avg Win Hold / Avg Loss Hold,
  Longest Losing Streak.
- R-multiple suite: Avg R/Trade, Avg Winning/Losing R, Best/Worst R,
  Avg Risk/Trade, R-Multiple Distribution + Performance charts (notes which
  trades are excluded for missing stop loss).
- Rolling Win Rate (20-trade window); Metric Evolution.
- Breakdowns: P&L by Symbol, Performance by Day of Week / Session /
  Time of Day.
- Rule Compliance + Compliance Impact (tied to Settings → Risk Rules;
  "compliant vs non-compliant" outcome comparison).
- Position Size Calculator (entry + stop → size).

## Trade detail (dialog)

- Header: symbol + WIN/LOSS, market, LONG/SHORT chips.
- Details: avg entry/exit, qty, hold, entry/exit totals.
- Risk/Reward panel: Target, Stop, target/stop deltas, Max profit/loss,
  Breakeven, Planned R:R, actual R-multiple.
- Price chart with target/stop annotations + "Expand chart".
- Executions list (BUY/SELL fills). Edit and Delete actions.

## New Trade drawer

- Header actions: **Templates**, **Save copies to** (multi-account copy).
- Tabs: General / Journal / Dividends.
- General: Market select, Symbol, LONG/SHORT toggle, **Target + Stop**
  fields, execution rows (BUY/SELL, datetime with picker, qty, price, fee,
  add/remove). Footer: Save / **Check compliance** / Cancel.

## New Setup / New Note

- New Setup: planned trade (thesis, target, stop, convert to trade later).
- New Note: standalone dated journal note.

## AI Coach (PRO, $10/mo)

- Chat panel available on every page: log/close/edit trades in plain
  English, pre-trade compliance + position sizing from user's own rules,
  behavioral warnings, leak analysis, long-term memory of trading patterns,
  open-positions queries.

## Settings

Sections: Profile, Accounts, **Rules** (risk-management rules powering
compliance), Tags, Shared links, Subscription, Recently Deleted (soft
delete/restore), Danger Zone.

## Other

- Import (PRO): broker CSV import.
- Migration wizard from V1.
- Share: public share links for stats (Shared links management in settings).
- PWA/offline support.

## Gap list vs TraderMemos today (roadmap candidates)

See also: [`competitive-day-trader-roadmap.md`](./competitive-day-trader-roadmap.md)
(Stonk Journal + TraderVue + TradeZella synthesis, day-trader priority order).

Already matched (partial): shell/dashboard/calendar, New Trade modal shape
(templates, target/stop, journal/dividends tabs, compliance button stub),
clickable WINS/OPEN filters UI, POS column, CSV import, Reports basics.

Still missing for session-ready use: open/partial trades in API+table,
real risk rules engine, R-mode analytics, playbook performance + convert
setup→trade, structured mistake/emotion tags, session/time-of-day leaks,
MAE/MFE, notes API, dividends in trade P&L, AI coach, soft delete, PWA.
