# Competitive Plan — TraderWaves

**Date:** 2026-08-08
**Sources:** traderwaves.com homepage, `/features`, `/features/trade-journal`, `/pricing`, `/alternative/journal`; TraderMemos API routes, `web/src/routes`, `mobile/src/app`, `api/internal/analytics`
**Goal:** Decide what TraderMemos should build in response to TraderWaves — and what it should deliberately not build.

Companion docs: [competitive-day-trader-roadmap.md](competitive-day-trader-roadmap.md) (TraderVue / TradeZella / Stonk Journal), [stonk-journal-v2-features.md](stonk-journal-v2-features.md), [mobile-monetization-plan.md](mobile-monetization-plan.md) (iOS free/Pro line — decides which of these features may be mobile-Pro-gated), [roadmap.md](roadmap.md) (unified sequencing across both plans).

---

## What TraderWaves is

A freemium cloud journal + analytics + backtesting workspace. Claims 52,000 traders across 198 countries.

| Tier | Price | Contents |
|---|---|---|
| **Essential** | Free forever, no card | Unlimited notes & images, **3** connected accounts, auto broker import + CSV, customisable dashboard, P&L calendar, economic calendar, charts with indicators & drawings, trade & account sharing, market watchlist |
| **Pro** | $19.99/mo · $239.88/yr | Unlimited accounts, unlimited backtesting, Wave AI Coach, equity & drawdown analytics, advanced charts + price alerts, Monte Carlo simulator, custom tags + self-assessment review, CSV export, portfolio sharing, custom colour themes, news/session/account alerts, pro dashboard widgets, priority sync |

Positioning is "forever free, no credit card" as a wedge against TradeZella ($35/mo) and TraderSync (7-day trial). Their `/alternative/journal` page is a ranked SEO listicle across nine products, not a feature matrix.

**Their real moats:** broker connectivity (700+, incl. MT4/MT5, cTrader, DXtrade, MatchTrader), backtesting, and SEO surface area.
**Not moats:** analytics depth, review workflow, mobile craft.

---

## Feature comparison

| Area | TraderWaves | TraderMemos | Verdict |
|---|---|---|---|
| Journal, notes, screenshots | Unlimited | `/notes`, `/media`, note images as `tm-media:` refs | Parity |
| Daily journal vs trade journal | Both | `day.$date.tsx`, `quick-journal` | Parity |
| Tags / mistake / emotion | Yes | `tags`, `emotional_state` | Parity |
| Self-assessment sliders | Pro-gated | `confidence`, `trade_quality` — free | **TM ahead** |
| Equity curve / drawdown | Pro-gated | `/analytics/equity-curve` incl. `max_drawdown` — free | **TM ahead** |
| Core stats | Win rate, PF, RR | + `expectancy`, `sqn`, `kelly_pct`, medians, gross/net split | **TM ahead** |
| MAE / MFE | Session charts | `/trades/:id/excursion`, auto-computed | Parity |
| Session / hour / setup breakdowns | Sessions only | `session.go`, `duration.go`, `breakdown.go` | **TM ahead** |
| Behavioral analytics | "Smart Insights" (unspecified) | `behavior.go` — revenge, overconfidence, loss aversion | **TM well ahead** |
| Rule compliance | — | `compliance.go` + `/settings/risk-rules` | **TM only** |
| Prop-firm mode | — | `prop-settings`, `prop-status` | **TM only** |
| Playbook / strategy library | Yes | `/setups`, `/playbook` | Parity |
| Journal templates | Yes | `/settings/checklist-template` (single global) | Partial gap |
| Economic calendar | Yes | `/economic-events` | Parity |
| Charts + indicators/drawings | TradingView-integrated | `/chart`, `/market/bars`, lightweight-charts | Gap |
| Calculators | Position size, risk | Position size, R, Kelly, FX | Parity |
| Trade replay | — | Web + mobile (`useReplayController`, `ChartCanvas`) | **TM only** |
| **Auto broker sync** | **700+ brokers** | **IBKR Flex only** (`/accounts/:id/flex-sync`) | **Biggest gap** |
| CSV import | Yes | Mapping + dedup + 6 broker presets | Parity |
| **Backtesting** | Unlimited (Pro) | — (replay exists, but only over recorded trades) | **Gap** |
| **Monte Carlo** | Pro | — | Gap |
| **Alerts** | Price / news / session / account | — | Gap |
| **Watchlist** | Free | — | Minor gap |
| **Public share pages** | Verified track record | Image share only (mobile `share-trade`) | Gap |
| Customisable dashboard | Drag-and-drop widgets | Fixed bento layout | Gap (intentional) |
| Portfolio across accounts | Yes | Single-`accountId` filter + contribution card | Partial gap |
| Crypto wallet tracking | Yes | Removed deliberately | Skip |
| Social feed / leaderboard | Coming soon | — | Skip |
| Native mobile | iOS + Android | Expo + `@expo/ui`, native iOS 26 idioms | Parity / TM ahead on iOS |
| AI coach | Wave AI, vendor keys | `/trades/:id/coach` + OCR, **your** OpenAI-compatible keys | **TM ahead on control** |
| i18n | English | en / ja / ko / zh-HK | **TM ahead** |
| Data ownership | Vendor cloud | Self-hosted SQLite, AGPL | **TM's thesis** |

### Read

TraderMemos is **ahead on review depth** and behind on **ingestion and distribution**. TraderWaves' advantage is getting trades into the journal and getting traders onto the site — not what happens once they're there.

Three gaps matter. Everything else on their list is either already covered, deliberately rejected, or marketing.

1. **Broker connectivity** — a journal is only as good as the trades in it. Today that means IBKR Flex or a hand-mapped CSV.
2. **Backtesting** — their only feature outside the review loop. ~80% of the machinery already exists here.
3. **Discoverability** — `marketing/` has no feature or comparison pages.

**Differentiator to protect:** self-hosted sovereignty, behavior/compliance analytics, prop mode, your-own-AI-keys. These are things a subscription cloud product structurally cannot ship — its business model requires holding the data, and its AI costs money per user.

**Do not chase:** breadth. TraderWaves cannot be out-breadthed, and "free" is not a differentiator against a free tier.

---

## Plan 1 — MT5 / cTrader / DXtrade importers  ·  P0

**Goal:** cover the retail forex/CFD majority TraderWaves owns, with no vendor API.

**Why first:** every downstream feature is gated on trades existing in the DB.

**Where:** `api/internal/importer/`. `brokers.go` holds `brokerPresets []BrokerPreset` matched by header signature via `MatchBroker(headers) (name, mapping, tz, ok)`. Six presets exist (IBKR, ThinkOrSwim, Webull, Schwab, Tradovate, NinjaTrader).

**Work**

1. **cTrader / DXtrade / MatchTrader** — plain CSV. Pure additions to `brokerPresets`: header signature, column mapping, preset timezone. Covered by the existing `brokers_test.go` pattern.
2. **MT4 / MT5 statements** — HTML (`ReportHistory*.html`) and XLSX, not CSV. New parser beside `generic.go` / `json.go`:
   - `importer/mt5.go` implementing the existing `Importer` interface → `ParseResult`.
   - Detect by content sniff, not headers (`<title>` contains "Trade History Report"; MT5 XLSX sheet name).
   - MT5 *deals* are fill-level and map directly to `ParsedExecution`. MT4 "Closed Transactions" are trade-level and must be synthesized into an open + close fill pair.
   - Lot size → `Multiplier` (see `instrument.go`, `DefaultMultiplier`).
   - Swap and commission → keep distinct; `Execution` already carries both `fees` and `commission`.
3. **Timezone.** MT5 reports broker-server time (usually EET, GMT+2/+3), never UTC. This is the exact trap behind the historical trade-entry timezone corruption. The preset must carry a `tz`, and the import preview must let the user override it **before** commit.
4. Fixtures under `importer/testdata/`, one per format.

**Sequence:** A — three CSV presets. B — MT5 XLSX. C — MT4/MT5 HTML. D — OpenAPI + a supported-brokers docs page.

**Risk:** MT4/5 report layouts vary by broker build. Fail soft — unmatched rows already flow into `RowError` and surface in preview instead of aborting the import.

---

## Plan 2 — `tm-sync` local watcher agent  ·  P0

**Goal:** the self-hosted answer to "auto broker import" — strictly better on privacy.

**Design:** a single Go binary at `api/cmd/tm-sync/`, reusing the existing module.

- Config `~/.tm-sync.toml`: API base URL, a `tm_pat_…` personal access token (`/access-tokens` already issues these), account ID, and watch rules `{path, glob, preset}`.
- Loop: fsnotify on the directory → parse **client-side with the same `importer` package** → POST fills to `/executions` → `POST /trades/regroup`.
- Idempotency is free: `dedup.go` and `DedupHash` already de-duplicate server-side, so re-reading a statement is a no-op. This is what makes a naive watcher safe.
- Ship cross-platform binaries in the release workflow. **Windows matters most** — MT5 runs there.

**Why it is a moat, not catch-up:** TraderWaves reads your live account through an aggregator. This reads a file your terminal already wrote, on your machine, and posts to your own server. State it explicitly in the README comparison table.

**Sequence:** depends on Plan 1's parsers. A — binary, config, one-shot `tm-sync import <file>`. B — watch mode. C — docs + release artifacts.

---

## Plan 3 — Public share pages  ·  P0

**Goal:** a revocable, read-only public link to a performance summary. Growth loop for the project; for self-hosters, the way to show a record to a prop firm or mentor.

**Data model** — new migration, `share_links`:

```
id, user_id, token (random, indexed), scope_json,
created_at, expires_at, revoked_at, view_count
```

`scope_json` holds the filter snapshot (accounts, date range) **and a field allowlist** — e.g. show equity-curve shape, win rate and profit factor while hiding absolute amounts. Reuse the privacy-mode vocabulary, but enforce it **server-side**; never trust the client.

**API**

- `POST /share-links`, `GET /share-links`, `DELETE /share-links/:id` on the `protected` group.
- `GET /public/share/:token` mounted on `v1` **outside** `auth.Middleware` (`api/internal/api/server.go:164`), rate-limited like the auth routes.

**Web:** `/s/$token` rendering a read-only composition of `wrapped.tsx` and `ReportsSummaryBento`. `wrapped.tsx` is 57 lines — the shareable view is mostly recomposition.

**Security — non-negotiable**

- High-entropy token, constant-time comparison.
- Default 90-day expiry, explicit opt-out.
- The public endpoint returns an **aggregate DTO built by a dedicated serializer** — never the authed handler with a filter applied, and never raw trades, account names, or user IDs.
- Because instances are self-hosted, sharing is **off by default** behind a server setting.

**Sequence:** A — migration, CRUD, public endpoint, tests. B — web share view. C — Share affordance on Reports + revoke UI in settings. D — mobile share sheet points at the URL rather than only an image.

**Monetization boundary** (see [mobile-monetization-plan.md](mobile-monetization-plan.md)): share *pages* and the mobile share *capability* are free — they are the growth loop and must never be gated. Only cosmetics are Pro: extra mobile card styles and removal of the small "TraderMemos" mark. The mark on free-tier cards *is* the growth loop working.

---

## Plan 4 — Free-symbol replay (the backtester)  ·  P1

**Goal:** replay any symbol and date, record hypothetical trades, and let them flow through the **existing** analytics stack. That is the differentiator — TraderWaves' backtest results sit in a silo; ours would produce expectancy, SQN, session breakdowns and behavior flags for free.

**Already built:** `web/src/components/charts/useReplayController.ts`, `ReplayControls.tsx`, `TradeChartSection.tsx`, `replayPnl.ts`, `barsToCandlestickData.ts`, `lightweight-charts`; `/market/bars` backed by `marketdata.Service` with `memCache` + DB cache (Yahoo / Finnhub). Mobile has the equivalent in `lib/replay.ts` + `chart-canvas.tsx`.

**Missing is only the input side**

1. `web/src/routes/replay.tsx` — symbol + date + interval picker instead of a trade ID.
2. Blind mode: fetch the window, render only up to the cursor, step forward.
3. Buy / Sell / Close at the current bar close, appending synthetic fills into the same book-keeping `computeReplayRun` performs.
4. **Persist the session** as trades in an account flagged `kind = 'backtest'` (new nullable column on `accounts`). Every analytics endpoint already takes `account_id`, so nothing downstream changes. Exclude paper accounts from default aggregates.

**Backend:** `/market/bars` must accept a symbol with no owning trade, and needs harder caching — a replay session hammers it. Extend the DB cache TTL for historical windows; bars older than today never change.

**Explicit non-goal:** no strategy scripting language, no optimizer. Manual bar replay is what traders use and it is ~10% of the work.

**Sequence:** A — paper-account flag + aggregate exclusion. B — `/replay` route, read-only stepping. C — order entry + persistence. D — mobile parity.

---

## Plan 5 — Monte Carlo on Reports  ·  P1

Smallest high-value item; Pro-gated for them.

- `api/internal/analytics/montecarlo.go` + `GET /analytics/montecarlo` (`iterations`, `trades_per_run`, `starting_equity`), matching the one-file-per-analytic layout of `r_summary.go`, `session.go`, `behavior.go`.
- Bootstrap-resample the net-P&L series with replacement, N = 10,000. Return terminal-equity percentiles (p5/p25/p50/p75/p95), max-drawdown distribution, and risk of ruin at a user-set threshold.
- Deterministic seed parameter, so results are reproducible and testable.
- Web: a card on Reports beside the profit-factor gauge — recharts fan chart plus a "risk of ruin: X%" headline. Match the client-side conventions in `lib/kelly.ts`.

**Caveat to surface in the UI:** i.i.d. resampling ignores serial correlation — which `behavior.go`'s revenge-trading detector proves is real. One line of copy, not a blocker.

---

## Plan 6 — Portfolio mode across accounts  ·  P2

`web/src/lib/filters.ts` stores a single `accountId`, persisted through zustand `partialize`. Prop traders run 3–8 accounts and prop mode already courts them, so this is table stakes for the best-fit audience.

- Store: `accountId?: string` → `accountIds?: string[]`; bump the persist `version` and migrate.
- API: `api/internal/api/filters.go` accepts repeated `account_id`; all `/analytics/*` handlers already funnel through it.
- **Currency is the real problem.** Accounts may differ in `pnl_currency`. `money/` and `/market/fx` exist. Either convert to a labelled base currency or refuse to aggregate mixed-currency accounts — decide before writing the query.
- Reuse `HomeAccountContribution.tsx` for the per-account split.

---

## Plan 7 — Journal alerts  ·  P2

Deliberately **not** price alerts — that is a market-data product and a poor fit for self-hosting.

Rules evaluated on write and on a schedule (`api/internal/jobs/` exists):

- risk rule broken — `compliance.go` already computes this
- N consecutive losses / daily loss limit hit — `DailyLossCard` logic exists
- prop drawdown threshold approaching — `prop/`
- unreviewed trades older than 7 days

Delivery: Expo push (the app is already installed) plus a generic outgoing webhook (Discord / Telegram / ntfy). Settings live alongside `/settings/risk-rules`.

**Free, not Pro.** Resolved against [mobile-monetization-plan.md](mobile-monetization-plan.md), which originally listed push alerts as a Pro candidate: alerts evaluated and sent from the user's own server (webhooks, self-delivered push) are **free** — TraderWaves Pro-gates alerts, and we win precisely by not gating them. The only thing that could ever be paid is a TraderMemos-*operated* push relay, if one ever exists — gate the relay service, never the feature.

---

## Plan 8 — Marketing surface  ·  P3

`marketing/` has no feature or comparison pages. TraderWaves farms every "best trading journal" query through `/features/*` and `/alternative/*`.

- `/features/<slug>` — one per pillar: self-hosted, behavior analytics, prop-firm mode, rule compliance, AI with your own keys.
- `/alternative/<competitor>` — tradezella, tradersync, tradervue, traderwaves. Honest tables; the analytics rows genuinely win.
- **Unfair advantage: i18n.** The site is already multilingual (`/[lang]/`). Japanese, Korean and HK trading-journal queries are near-empty, as are "self-hosted trading journal" and "open source TradeZella alternative".

---

## Explicitly defer / reject

| Item | Why |
|---|---|
| Crypto wallet tracking | Removed deliberately once already |
| Social feed, leaderboard, trader profiles | Vanity surface, moderation liability, meaningless on a single-tenant instance |
| Drag-and-drop dashboard widgets | High complexity, low retention lift; a designed bento beats a user-arranged grid |
| Custom colour themes | `DESIGN.md` exists for a reason |
| Price / news alerts | Market-data product, not a review tool |
| Broker OAuth aggregation | Impossible and undesirable for self-hosted; `tm-sync` is the better answer |

---

## Sequencing

| Wave | Plans | Rationale |
|---|---|---|
| **1** | 1 (CSV presets) · 3 (share) · 5 (Monte Carlo) | Cheap, independent, immediately visible; touch disjoint files so they can run concurrently |
| **2** | 1 (MT4/5 parsers) → 2 (`tm-sync`) | Ingestion is the real moat; parsers must land before the agent |
| **3** | 4 (free-symbol replay) | Independent, but the largest single item |
| **4** | 6 · 7 · 8 | Polish and funnel |

Each plan gets a typed branch in `.claude/worktrees/<name>` — several are parallelizable and this repo is shared across sessions.

---

## Open decisions

1. **Share pages** — off by default behind a server setting, or on with a 90-day expiry? A self-hosted instance leaking a track record is a different risk class from a SaaS doing it.
2. **Portfolio currency** — convert mixed-currency accounts through `/market/fx`, or block cross-currency aggregation and force same-currency groups? This shapes the query layer, so settle it before Plan 6 starts.

---

## Success criteria

After Waves 1–3, a trader can:

1. Get MT5 / cTrader fills into the journal without touching a spreadsheet.
2. Keep them arriving automatically, without any account credential leaving the machine.
3. Publish a verifiable track record without exposing the trade log.
4. Test a setup on historical bars and review the result through the same analytics as live trades.
5. See the distribution of outcomes, not just the single realized path.
