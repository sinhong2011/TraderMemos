# Spec — Mistake tax & Setup scorecard

Status: draft for owner review · 2026-10-04

Two read-side features that turn existing journal data into decisions:

- **Mistake tax** — what breaking your own process cost this period, in dollars and R.
- **Setup scorecard** — which playbook setups have a proven edge, which are bleeding, and which are too early to call.

Both answer "what do I change next session", not "what happened". Neither needs new input from the user; both reward the inputs that already exist (mistake tags, initial risk, setup link).

---

## 0. What the data already supports

| Need | Exists today | Gap |
|---|---|---|
| Mistake labels per trade | Tags with `kind = 'mistake'` (`trade_tags`), 12 presets in `web/src/lib/tagPresets.ts` | — |
| Rule breaches | `analytics.Compliance` (`api/internal/analytics/compliance.go`) scores **days**: risk-per-trade, daily loss, trade count, losing streak | Returns no trade IDs and no per-trade dollars |
| Behavior events | `GET /analytics/behavior` — revenge + overconfidence events carry `trade_id`, `net_pnl` | Dollars only, no R |
| R per trade | Derived at read time: `net_pnl / trade_journal.initial_risk` (`trade_detail.go:123`) | Only trades with `initial_risk` set |
| R distribution | `GET /analytics/r-summary` — 6 buckets, all trades pooled | Not per setup |
| Per-setup stats | `GET /analytics/breakdown?by=setup` keyed on `trade_journal.setup_id` → dollar `Summary` | No R, no sample-size handling, no verdict |
| Missed setups | `GET /missed-trades/summary` `by_setup` → planned `net_r` | — |

---

## 1. Mistake tax

### 1.1 The question it answers
"How much did not following my process cost me — and which mistake is the most expensive?"

### 1.2 Sources of a "mistake"
Each flagged trade carries one or more **sources**, labelled so the user can see why it counts:

| Source | Kind | How a trade is flagged |
|---|---|---|
| Mistake tag (e.g. *Chased*, *Moved stop*) | `tag` | Trade has that tag |
| Over max risk | `rule` | `initial_risk > risk_rules.max_risk_per_trade` |
| Traded past daily loss limit | `rule` | Trade **opened after** the day's running net P&L crossed `-max_daily_loss` |
| Over max trades per day | `rule` | Trade's ordinal for the day `> max_trades_per_day` |
| Past losing-streak limit | `rule` | Trade opened after `max_consecutive_losses` consecutive losers that day |
| Revenge trade | `behavior` | In `/analytics/behavior` revenge events |
| Oversized after a win streak | `behavior` | In overconfidence events |

Rule checks reuse `analytics.Compliance`'s existing logic; the change is to emit **per-trade** flags (add `ID` to `ComplianceTrade` and return `violating_trade_ids` per rule). Day-level output stays as is for the existing card.

### 1.3 How cost is counted
- **Cost of a flagged trade = its loss only**: `max(-net_pnl, 0)`. A mistake that happened to win does **not** reduce the tax — a lucky win is not an edge.
- **Lucky wins** are reported separately: `Σ max(net_pnl, 0)` over flagged trades, labelled "won anyway". This is the number that tells a trader the mistake is still a mistake.
- **Total tax counts each trade once**, even if it has three sources. Per-source rows count a trade under every source it has (rows can sum to more than the total — the UI says so).
- **R**: `cost_r = Σ max(-r, 0)` over flagged trades with `initial_risk`; coverage shown as "R on 14 of 19 trades".
- **Counterfactual**: `net_pnl_without = period_net − Σ net_pnl(flagged)` — "without these trades you'd be +$2,960 instead of +$1,120". Labelled as an estimate (skipping a trade can change later trades).

### 1.4 API
`GET /analytics/mistake-tax` — shared filters (`account_id, from, to, symbol, side, duration, date_basis, tz`).

```jsonc
{
  "period_net": 1120.0,
  "gross_loss": 4840.0,            // Σ losses, all trades
  "total_cost": 1840.0,            // deduped
  "total_cost_r": 9.6,
  "r_coverage": { "with_risk": 14, "flagged": 19 },
  "share_of_losses": 0.38,         // total_cost / gross_loss
  "lucky_wins": 410.0,
  "net_without": 2960.0,
  "flagged_trades": 19,
  "sources": [
    { "key": "tag:chased", "kind": "tag", "label": "Chased",
      "trades": 7, "cost": 920.0, "cost_r": 4.8, "lucky": 120.0,
      "trade_ids": ["…"] },
    { "key": "rule:daily_loss", "kind": "rule", "label": "Traded past daily loss limit", … }
  ],
  "series": [ { "period": "2026-09", "cost": 2310.0 }, { "period": "2026-10", "cost": 1840.0 } ],
  "unreviewed_losses": 12          // losers with no mistake tag and no note
}
```
`series` buckets by week when the range ≤ 3 months, else by month (market-tz periods, like every other bucket).

### 1.5 Web
- **Reports → Overview, first card** "Mistake tax":
  - Hero: `$1,840` (neutral ink — it is a cost, not a P&L), sub-line "38% of this period's losses · 9.6R".
  - Counterfactual line: "Without them: +$2,960 instead of +$1,120".
  - Ranked rows per source: label, source chip (Tag / Rule / Behavior), trades, cost bar, cost R, "won anyway" in muted text. Row click → Trades filtered to `trade_ids`.
  - Small series sparkline: cost per week/month — the trend the user is trying to push down.
  - Footer nudge when `unreviewed_losses > 0`: "12 losing trades have no mistake tag — review them" → Trades filtered to those (bridges to the future review inbox).
- **Today page**: one line under the session summary, "Mistake tax today: $0" / "$240 · Chased". Silent when zero trades.
- Empty states: no flagged trades → "No mistakes logged this period" + how to tag; no mistake tags exist at all → link to Settings → Journal presets.

### 1.6 Mobile (follow-up PR)
Same endpoint; a card at the top of Reports and the one-liner on Home. Uses `useFormatters()` for money (privacy mode).

---

## 2. Setup scorecard

### 2.1 The question it answers
"Which setups should I size up, keep testing, or stop trading?"

### 2.2 Per-setup metrics
Grouped by the trade's **main** setup (`trade_journal.setup_id`), matching today's breakdown. Trades without a setup form an "(No setup)" row at the bottom — itself a useful number.

| Metric | Definition |
|---|---|
| `trades` | n |
| `win_rate` | wins / (wins + losses), scratches excluded as today |
| `expectancy_r` | mean R over trades with `initial_risk` |
| `ci_r` | 95% interval: `expectancy_r ± 1.96 · sd_r / √n_r` |
| `avg_win_r`, `avg_loss_r`, `profit_factor` | R units |
| `r_distribution` | same 6 buckets as `/analytics/r-summary` |
| `net_pnl`, `expectancy` | dollars (always shown) |
| `r_coverage` | n_r / n — below 60% the row falls back to dollars and says "add initial risk" |
| `clean_expectancy_r` | expectancy over the setup's trades **without** mistake tags or rule flags |
| `missed` | from missed-trades `by_setup`: count + planned `net_r` |
| `last_trade_at` | for "stale" detection |

### 2.3 Verdict
Uses R when coverage ≥ 60%, else dollar expectancy with the same rules.

| Verdict | Rule | Copy |
|---|---|---|
| **Edge** | n ≥ 20 and CI lower bound > 0 | "Proven edge — size up within your risk rules" |
| **Promising** | expectancy > 0, CI crosses 0 | "Positive so far — keep taking it at normal size" |
| **Execution problem** | expectancy ≤ 0 but `clean_expectancy_r` > 0 (n_clean ≥ 10) | "The setup works when you follow it — the leak is execution" |
| **Bleeding** | n ≥ 20 and CI upper bound < 0 | "Losing with enough trades to trust it — stop or rework" |
| **Unproven** | n < 10 | "Too early — 7 of 20 trades" |
| **Stale** | no trade in 60 days | "Not traded since Aug 3" (shown alongside any verdict) |

Thresholds live in one constant block so they can be tuned later; not user-configurable in v1.

### 2.4 API
`GET /analytics/setup-scorecard` — shared filters. Returns `{ setups: [ { setup_id, name, verdict, …metrics } ], none: {…} }`, sorted Edge → Execution problem → Promising → Unproven → Bleeding, then by `expectancy_r`.

One query for the trades + journal rows + mistake tags (not one per trade like today's breakdown handler).

### 2.5 Web — Playbook becomes the scorecard
Each setup row:
- Name, verdict badge, stale hint.
- **Expectancy interval bar** (signature visual): a horizontal bar on an R axis centred on 0, the dot at `expectancy_r`, the whisker spanning the CI. A setup with edge sits clearly right of zero; an unproven one has a whisker straddling it. One glance replaces three numbers.
- n · win rate · avg win/loss R · PF.
- R-distribution sparkline (6 bars).
- "Clean: +0.42R" when it differs from actual by ≥ 0.15R.
- Net $ and missed-trade count.
- Row click → setup detail (existing playbook detail) with the trades list filtered to the setup.

Header strip: "3 setups with edge · 1 bleeding · 4 too early". Unused setups stay as chips below.

### 2.6 Mobile (follow-up PR)
Playbook tab adopts the same rows; interval bar drawn with the existing chart primitives.

---

## 3. Delivery plan

| PR | Scope | Notes |
|---|---|---|
| 1 | `GET /analytics/setup-scorecard` + Playbook scorecard (web) | All inputs exist; no migration. Tests: verdict table, CI math, coverage fallback, `(No setup)` row. |
| 2 | Per-trade compliance flags + `GET /analytics/mistake-tax` + Reports card + Today one-liner (web) | Extends `analytics.Compliance` without changing its current payload. Tests: dedupe, lucky wins, counterfactual, each rule source, market-tz buckets. |
| 3 | Mobile: both features | Formatters via `useFormatters()`; Lingui strings in all four locales. |
| — | OpenAPI + `marketing` API reference regenerate with each API PR | |

Each UI PR is driven end to end on web (and device for mobile) per `AGENTS.md`, with seeded trades that make each verdict and each mistake source appear at least once.

## 4. Owner decisions (2026-10-04)
1. Cost = **losses only**; lucky wins reported separately.
2. Sources = **mistake tags + auto-detected rule and behavior flags**, each row labelled with its source.
3. Verdict thresholds as proposed (defaults, tunable in code).
4. Build order: **setup scorecard first**, then mistake tax.
